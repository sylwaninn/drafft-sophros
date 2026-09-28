// Failed events: the outbox's dead-letter queue (drafft-backend 20260928000121_outbox_production). A side
// effect (a push, an email, a Stream change, an R2 deletion) that kept failing for its whole retry budget
// waits here for an admin: replay it (db-events runs only the steps it hadn't done) or discard it, with a
// reason. Both are audited. Live: the page re-reads when the queue or a provider's circuit changes.
import { useState } from "react";
import { RotateCcwIcon, ServerCrashIcon, Trash2Icon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Button } from "~/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "~/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ActButton, ReasonDialog } from "~/components/app/act";
import { Nothing, Page, PageHeader, TimeAgo } from "~/components/app/bits";
import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
import { pageParam } from "~/lib/paging";
import type { Route } from "./+types/failed-events";

export interface FailedEvent {
  id: number;
  event: string;
  payload: Record<string, unknown>;
  attempts: number;
  replays: number;
  createdAt: string;
  failedAt: string;
  lastError: string | null;
  provider: string | null;
  steps: string[];
}

export interface Circuit {
  provider: string;
  state: "closed" | "open" | "half_open";
  openedAt: string | null;
  retryAt: string | null;
  lastError: string | null;
}

interface FailedEvents {
  events: FailedEvent[];
  total: number;
  waiting: number;
  circuits: Circuit[] | null;
}

const pageSize = 100;

export async function loader({ request, context }: Route.LoaderArgs) {
  const page = pageParam(new URL(request.url).searchParams.get("page"));
  const data = await query<FailedEvents>(context.get(staffContext), "admin_failed_events", {
    p_limit: pageSize,
    p_offset: page * pageSize,
  });
  return { ...data, page, more: data.total > (page + 1) * pageSize };
}

const providerNames: Record<string, string> = { stream: "Stream", apns: "APNs", resend: "Resend", twilio: "Twilio", r2: "R2" };

function CircuitBadge({ circuit }: { circuit: Circuit }) {
  const name = providerNames[circuit.provider] ?? circuit.provider;
  if (circuit.state === "closed") return <Badge variant="secondary">{name}: up</Badge>;
  return (
    <Badge variant="destructive" title={circuit.lastError ?? undefined}>
      {name}: {circuit.state === "open" ? "down" : "testing"}
    </Badge>
  );
}

/** A payload as a short line of its keys and values: ids, never the content of a message. */
function payloadLine(payload: Record<string, unknown>) {
  return Object.entries(payload ?? {})
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
}

function DiscardDialog({ ids, trigger }: { ids: number[]; trigger: React.ReactNode }) {
  return (
    <ReasonDialog
      intent="events-discard"
      fields={{ id: ids }}
      title={ids.length === 1 ? "Discard this event" : `Discard ${ids.length} events`}
      description="It will never be sent. Do this when it no longer matters (the account or the match is gone, or the team handled it by hand)."
      placeholder="Why it no longer needs sending, for the audit log"
      submit="Discard"
      destructive
      trigger={trigger}
    />
  );
}

export default function FailedEventsPage({ loaderData: { events, total, waiting, circuits, page, more } }: Route.ComponentProps) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  // Only what's still on screen: a replayed or discarded event leaves the list, and the selection with it.
  const selected = events.map((e) => e.id).filter((id) => picked.has(id));
  const all = events.length > 0 && selected.length === events.length;
  const toggle = (id: number, on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Page>
      <PageHeader
        title="Failed events"
        description="Side effects the backend couldn't complete within their retry budget (a push, an email, a chat change, a file deletion). Replay one once its cause is fixed, or discard it with a reason. Both go to the audit log."
        actions={
          selected.length > 0 && (
            <>
              <ActButton intent="events-replay" fields={{ id: selected }} variant="outline">
                <RotateCcwIcon data-icon="inline-start" />
                Replay {selected.length}
              </ActButton>
              <DiscardDialog
                ids={selected}
                trigger={
                  <Button variant="outline">
                    <Trash2Icon data-icon="inline-start" />
                    Discard {selected.length}
                  </Button>
                }
              />
            </>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {(circuits ?? []).map((c) => (
          <CircuitBadge key={c.provider} circuit={c} />
        ))}
        {waiting > 0 && (
          <span>
            {waiting} event{waiting === 1 ? "" : "s"} waiting for a provider to come back
          </span>
        )}
      </div>
      {events.length === 0 ? (
        <Card className="py-0">
          <Nothing icon={<ServerCrashIcon />} title="No failed events">
            Everything the backend had to send went out.
          </Nothing>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    aria-label="Select every event on this page"
                    checked={all ? true : selected.length > 0 ? "indeterminate" : false}
                    onCheckedChange={(v) => setPicked(v === true ? new Set(events.map((e) => e.id)) : new Set())}
                  />
                </TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Last error</TableHead>
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id} data-state={picked.has(e.id) ? "selected" : undefined}>
                  <TableCell className="pl-4 align-top">
                    <Checkbox
                      aria-label={`Select event ${e.id}`}
                      checked={picked.has(e.id)}
                      onCheckedChange={(v) => toggle(e.id, v === true)}
                    />
                  </TableCell>
                  <TableCell className="max-w-96 align-top whitespace-normal">
                    <Badge variant="outline" className="font-mono">
                      {e.event}
                    </Badge>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">#{e.id}</span>
                    <p className="mt-1 font-mono text-xs break-all text-muted-foreground">{payloadLine(e.payload)}</p>
                    {e.steps.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Already done: {e.steps.join(", ")}</p>}
                  </TableCell>
                  <TableCell className="align-top">
                    <TimeAgo value={e.failedAt} />
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {e.attempts} attempt{e.attempts === 1 ? "" : "s"}
                      {e.replays > 0 && `, replayed ${e.replays}×`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      created <TimeAgo value={e.createdAt} />
                    </p>
                  </TableCell>
                  <TableCell className="max-w-96 align-top whitespace-normal">
                    {e.provider && (
                      <Badge variant="secondary" className="mr-2">
                        {providerNames[e.provider] ?? e.provider}
                      </Badge>
                    )}
                    <span className="font-mono text-xs break-words text-muted-foreground">{e.lastError ?? "No answer"}</span>
                  </TableCell>
                  <TableCell className="pr-4 text-right align-top">
                    <div className="flex justify-end gap-1">
                      <ActButton intent="events-replay" fields={{ id: e.id }} variant="ghost" size="sm">
                        <RotateCcwIcon data-icon="inline-start" />
                        Replay
                      </ActButton>
                      <DiscardDialog
                        ids={[e.id]}
                        trigger={
                          <Button variant="ghost" size="sm">
                            <Trash2Icon data-icon="inline-start" />
                            Discard
                          </Button>
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <p className="text-sm text-muted-foreground tabular-nums">
        {total} failed event{total === 1 ? "" : "s"}. A replay runs only the steps not done yet, with a fresh budget, and never sends a push
        that has gone stale.
      </p>
      {(page > 0 || more) && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                to={`?page=${page - 1}`}
                aria-disabled={page === 0}
                className={page === 0 ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                to={`?page=${page + 1}`}
                aria-disabled={!more}
                className={!more ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </Page>
  );
}

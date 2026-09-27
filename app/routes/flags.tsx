import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { EyeIcon, FlagIcon } from "lucide-react";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { ActButton } from "~/components/app/act";
import { MediaTile, Nothing, OverlayBadge, Page, PageHeader, Panel, PersonLink, TimeAgo } from "~/components/app/bits";
import { QueueItem, QueueMotion } from "~/components/app/motion";
import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
import type { Flag, Person } from "~/lib/types";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/flags";

interface FlaggedUser {
  person: Person;
  flags: number;
  rejected: number;
  inChats: number;
  lastFlag: string;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const staff = context.get(staffContext);
  const open = new URL(request.url).searchParams.get("status") !== "all";
  const [flags, users] = await Promise.all([
    query<Flag[]>(staff, "admin_flags", { p_open: open, p_limit: 120 }),
    query<FlaggedUser[]>(staff, "admin_flagged_users", { p_limit: 20 }),
  ]);
  return { flags, users };
}

export default function Flags({ loaderData: { flags, users } }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const all = params.get("status") === "all";
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const open = flags.filter((f) => !f.reviewed_at);
  const chosen = [...selected].filter((id) => open.some((f) => f.id === id));
  const toggle = (id: number, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Page>
      <PageHeader
        title="Flagged media"
        description="Chat and profile photos the silent check found against the guidelines, or borderline. Nobody was told; look, then act on the account if needed."
        actions={
          <ToggleGroup type="single" variant="outline" size="sm" value={all ? "all" : "open"} onValueChange={(v) => v && navigate(v === "all" ? "?status=all" : "?", { replace: true })}>
            <ToggleGroupItem value="open">To look at</ToggleGroupItem>
            <ToggleGroupItem value="all">All</ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          {open.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={chosen.length === open.length ? true : chosen.length ? "indeterminate" : false}
                  onCheckedChange={(on) => setSelected(on === true ? new Set(open.map((f) => f.id)) : new Set())}
                />
                <Label htmlFor="select-all" className="font-normal text-muted-foreground">
                  {chosen.length ? `${chosen.length} selected` : "Select all"}
                </Label>
              </div>
              <ActButton intent="flags" fields={{ id: chosen }} size="sm" disabled={!chosen.length} onClick={() => setTimeout(() => setSelected(new Set()))}>
                <EyeIcon data-icon="inline-start" />
                Mark looked at
              </ActButton>
            </div>
          )}
          {flags.length === 0 ? (
            <Nothing icon={<FlagIcon />} title="Nothing flagged to look at" />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              <QueueMotion>
                {flags.map((f) => (
                  <QueueItem key={f.id} id={f.id} className="space-y-3">
                    <MediaTile
                      mediaKey={f.key}
                      gallery={flags.map((x) => ({ key: x.key, caption: `${x.person?.name ?? "Someone"}, ${x.context}: ${x.labels.join(", ")}` }))}
                      index={flags.indexOf(f)}
                      title="Flagged media"
                      className={cn("rounded-xl transition-shadow", selected.has(f.id) && "ring-2 ring-primary")}
                    >
                      <OverlayBadge tone={f.verdict === "rejected" ? "danger" : "neutral"}>{f.context}</OverlayBadge>
                      {!f.reviewed_at && (
                        <Checkbox
                          aria-label="Select"
                          checked={selected.has(f.id)}
                          onCheckedChange={(on) => toggle(f.id, on === true)}
                          className="absolute top-2 right-2 size-5 bg-background/85 backdrop-blur-sm"
                        />
                      )}
                    </MediaTile>
                    <div className="space-y-1 px-0.5 text-sm">
                      <PersonLink person={f.person} />
                      <p className="text-xs text-muted-foreground">
                        {f.labels.slice(0, 3).join(", ")}
                        <br />
                        <TimeAgo value={f.created_at} />
                        {(f.userFlags30d ?? 0) > 1 && <>, {f.userFlags30d} flags in 30 days</>}
                        {f.reviewed_at && <>, looked at by {f.reviewed_by}</>}
                      </p>
                    </div>
                  </QueueItem>
                ))}
              </QueueMotion>
            </div>
          )}
        </div>
        <Panel title="Most flagged" description="Last 30 days" className="self-start" contentClassName="px-0">
          {users.length === 0 ? (
            <Nothing title="Nobody" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Account</TableHead>
                  <TableHead className="text-right">Flags</TableHead>
                  <TableHead className="pr-6 text-right">Chat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.person.id}>
                    <TableCell className="pl-6">
                      <PersonLink person={u.person} showHold={false} />
                    </TableCell>
                    <TableCell className="text-right">
                      {u.flags}
                      {u.rejected > 0 && <span className="text-destructive"> ({u.rejected})</span>}
                    </TableCell>
                    <TableCell className="pr-6 text-right">{u.inChats}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>
    </Page>
  );
}

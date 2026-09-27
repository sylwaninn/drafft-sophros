import { useEffect, useState } from "react";
import { Form, Link, useFetcher, useNavigate, useSearchParams } from "react-router";
import {
  ArrowRightIcon,
  CalendarIcon,
  FlagIcon,
  MessagesSquareIcon,
  SearchIcon,
  ShieldAlertIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "~/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { HoldBadge, Nothing, Page, PageHeader, PersonAvatar, PersonLink, TimeAgo } from "~/components/app/bits";
import { ConversationDrawer } from "~/components/app/conversation-drawer";
import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
import type { MatchRow, Person, UserRow } from "~/lib/types";
import type { Route } from "./+types/conversations";

const pageSize = 60;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loader({ request, context }: Route.LoaderArgs) {
  const staff = context.get(staffContext);
  const url = new URL(request.url);
  const p = url.searchParams;
  const page = Math.max(0, Number(p.get("page")) || 0);
  const user = p.get("user");
  const status = p.get("status");
  const rows = await query<MatchRow[]>(staff, "admin_matches", {
    p_user: user && uuid.test(user) ? user : null,
    p_query: p.get("q") ?? "",
    p_status: status === "active" || status === "ended" ? status : "all",
    p_reported: p.get("reported") === "1",
    p_flagged: p.get("flagged") === "1",
    p_sessions: p.get("sessions") === "1",
    p_limit: pageSize + 1,
    p_offset: page * pageSize,
  });
  // The person filtered on, for the chip: from the rows, or looked up when there are none.
  let person: Person | null = null;
  if (user && uuid.test(user)) {
    person = rows.flatMap((m) => [m.a, m.b]).find((x) => x.id === user) ?? null;
    if (!person) {
      const [found] = await query<UserRow[]>(staff, "admin_users", { p_query: user, p_limit: 1 });
      if (found) person = { id: found.id, name: found.name, moderation: found.moderation, photo: found.photo };
    }
  }
  return { rows: rows.slice(0, pageSize), more: rows.length > pageSize, page, person };
}

/** Picks the person whose conversations to show. */
function PersonFilter({ person, onPick }: { person: Person | null; onPick: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const fetcher = useFetcher<{ accounts: UserRow[] }>();
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => fetcher.load(`/search?q=${encodeURIComponent(q.trim())}`), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  if (person) {
    return (
      <Badge variant="secondary" className="h-8 gap-2 rounded-lg pr-1 pl-1.5 text-sm">
        <PersonAvatar person={person} className="size-5" />
        {person.name || "No name yet"}
        <Button variant="ghost" size="icon-xs" onClick={() => onPick(null)} aria-label="Show everyone's conversations">
          <XIcon />
        </Button>
      </Badge>
    );
  }
  const accounts = q.trim().length >= 2 ? (fetcher.data?.accounts ?? []) : [];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <UserRoundIcon data-icon="inline-start" />
          Person
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder="Name, email, phone or id" />
          <CommandList>
            <CommandEmpty>
              {q.trim().length < 2 ? "Type a name or an email" : fetcher.state === "loading" ? "Searching" : "No account matches."}
            </CommandEmpty>
            {accounts.length > 0 && (
              <CommandGroup>
                {accounts.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={a.id}
                    onSelect={() => {
                      setOpen(false);
                      setQ("");
                      onPick(a.id);
                    }}
                  >
                    <PersonAvatar person={a} className="size-6" />
                    <span className="font-medium">{a.name || "No name yet"}</span>
                    <span className="truncate text-muted-foreground">{a.email}</span>
                    <HoldBadge hold={a.moderation} className="ml-auto" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function Conversations({ loaderData: { rows, more, page, person } }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    if (!("open" in changes)) next.delete("page");
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    navigate(`?${next}`, { replace: true, preventScrollReset: true });
  };
  const at = (p: number) => {
    const next = new URLSearchParams(params);
    if (p > 0) next.set("page", String(p));
    else next.delete("page");
    return `?${next}`;
  };
  const flags = ["reported", "flagged", "sessions"].filter((k) => params.get(k) === "1");
  const filtered = ["user", "q", "status", "reported", "flagged", "sessions"].some((k) => params.get(k));

  return (
    <Page>
      <PageHeader
        title="Conversations"
        description="Every match, newest first. Click one to read it; each reading is written to both accounts' trail."
      />
      <div className="flex flex-wrap items-center gap-2">
        <PersonFilter person={person} onPick={(id) => set({ user: id })} />
        <Form method="get" className="w-full sm:w-64">
          {[...params.entries()]
            .filter(([k]) => k !== "q" && k !== "page")
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          <InputGroup className="h-8">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput name="q" type="search" defaultValue={params.get("q") ?? ""} placeholder="Name or email of either" />
          </InputGroup>
        </Form>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={params.get("status") ?? "all"}
          onValueChange={(v) => v && set({ status: v === "all" ? null : v })}
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="active">Active</ToggleGroupItem>
          <ToggleGroupItem value="ended">Ended</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          value={flags}
          onValueChange={(v) =>
            set({
              reported: v.includes("reported") ? "1" : null,
              flagged: v.includes("flagged") ? "1" : null,
              sessions: v.includes("sessions") ? "1" : null,
            })
          }
        >
          <ToggleGroupItem value="reported">
            <ShieldAlertIcon />
            Reported
          </ToggleGroupItem>
          <ToggleGroupItem value="flagged">
            <FlagIcon />
            Flagged photos
          </ToggleGroupItem>
          <ToggleGroupItem value="sessions">
            <CalendarIcon />
            With sessions
          </ToggleGroupItem>
        </ToggleGroup>
        {filtered && (
          <Button variant="ghost" size="sm" asChild>
            <Link to="?" replace preventScrollReset>
              Clear filters
            </Link>
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <Nothing icon={<MessagesSquareIcon />} title={filtered ? "No conversation matches" : "No match yet"}>
          {filtered ? "Loosen a filter, or pick someone else." : undefined}
        </Nothing>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Between</TableHead>
                <TableHead />
                <TableHead>Matched</TableHead>
                <TableHead>Signals</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead className="pr-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow
                  key={m.id}
                  className="cursor-pointer"
                  data-state={params.get("open") === m.id ? "selected" : undefined}
                  onClick={() => set({ open: m.id })}
                >
                  <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                    <PersonLink person={m.a} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <PersonLink person={m.b} />
                  </TableCell>
                  <TableCell>
                    <TimeAgo value={m.createdAt} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {m.endedAt && <Badge variant="outline">Ended</Badge>}
                      {m.reported && <Badge variant="destructive">Reported</Badge>}
                      {(m.chatFlags ?? 0) > 0 && <Badge variant="secondary">{m.chatFlags} flagged</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{m.sessions || <span className="text-muted-foreground">None</span>}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => set({ open: m.id })}>
                      Read
                      <ArrowRightIcon data-icon="inline-end" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <ConversationDrawer matchId={params.get("open")} from="conversations list" onClose={() => set({ open: null })} />
      {(page > 0 || more) && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                to={at(page - 1)}
                aria-disabled={page === 0}
                className={page === 0 ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext to={at(page + 1)} aria-disabled={!more} className={!more ? "pointer-events-none opacity-50" : undefined} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </Page>
  );
}

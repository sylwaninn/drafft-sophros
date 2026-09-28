import { Form, Link, useNavigate, useSearchParams } from "react-router";
import { SearchIcon, UsersIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "~/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { HoldBadge, Nothing, Page, PageHeader, PersonAvatar, TimeAgo } from "~/components/app/bits";
import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
import type { UserRow } from "~/lib/types";
import { pageParam } from "~/lib/paging";
import type { Route } from "./+types/accounts";

const pageSize = 50;
const filters = [
  ["all", "All"],
  ["held", "On hold"],
  ["review", "Review"],
  ["selfie", "Selfie"],
  ["banned", "Banned"],
  ["flagged", "Flagged"],
  ["reported", "Reported"],
  ["premium", "tempo"],
  ["active", "Recently active"],
] as const;

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const page = pageParam(url.searchParams.get("page"));
  const rows = await query<UserRow[]>(context.get(staffContext), "admin_users", {
    p_query: url.searchParams.get("q") ?? "",
    p_filter: url.searchParams.get("filter") ?? "all",
    p_limit: pageSize + 1,
    p_offset: page * pageSize,
  });
  return { rows: rows.slice(0, pageSize), more: rows.length > pageSize, page };
}

export default function Accounts({ loaderData: { rows, more, page } }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") ?? "";
  const filter = params.get("filter") ?? "all";
  const link = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "" || v === 0) next.delete(k);
      else next.set(k, String(v));
    }
    return `?${next}`;
  };

  return (
    <Page>
      <PageHeader title="Accounts" description="Search by name, email, phone digits or account id." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Form method="get" className="w-full sm:w-80">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput name="q" type="search" defaultValue={q} placeholder="Name, email, phone or id" />
          </InputGroup>
        </Form>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={filter}
          onValueChange={(v) => v && navigate(link({ filter: v === "all" ? null : v, page: null }), { replace: true })}
          className="flex-wrap"
        >
          {filters.map(([value, label]) => (
            <ToggleGroupItem key={value} value={value}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {rows.length === 0 ? (
        <Nothing icon={<UsersIcon />} title="No account matches">
          Try part of the email, the phone's last digits, or the account id.
        </Nothing>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Account</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>Last opened</TableHead>
                <TableHead className="pr-4 text-right">30 days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id} className="group/row">
                  <TableCell className="pl-4">
                    <Link to={`/accounts/${u.id}`} viewTransition className="flex items-center gap-2 font-medium group-hover/row:underline">
                      <PersonAvatar person={u} className="size-7" />
                      {u.name || <span className="text-muted-foreground">No name yet</span>}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-56 truncate">{u.email}</div>
                    {u.phone && <div className="text-xs text-muted-foreground">+{u.phone}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <HoldBadge hold={u.moderation} />
                      {u.paused && !u.moderation && <Badge variant="secondary">Paused</Badge>}
                      {!u.onboarded_at && <Badge variant="outline">Onboarding</Badge>}
                      {u.premium && <Badge variant="outline">tempo</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <TimeAgo value={u.created_at} />
                  </TableCell>
                  <TableCell>
                    <TimeAgo value={u.last_active_at} />
                  </TableCell>
                  <TableCell>
                    <TimeAgo value={u.last_opened_at} />
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <div className="flex justify-end gap-1">
                      {u.flags > 0 && <Badge variant="secondary">{u.flags} flagged</Badge>}
                      {u.reports > 0 && <Badge variant="destructive">{u.reports} reported</Badge>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {(page > 0 || more) && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                to={link({ page: page - 1 })}
                aria-disabled={page === 0}
                className={page === 0 ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                to={link({ page: page + 1 })}
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

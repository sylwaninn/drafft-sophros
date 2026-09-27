import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "~/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Nothing, Page, PageHeader, PersonLink, TimeAgo } from "~/components/app/bits";
import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
import type { AuditEntry } from "~/lib/types";
import type { Route } from "./+types/audit";

const pageSize = 100;

export async function loader({ request, context }: Route.LoaderArgs) {
  const page = Math.max(0, Number(new URL(request.url).searchParams.get("page")) || 0);
  const rows = await query<AuditEntry[]>(context.get(staffContext), "admin_audit", { p_limit: pageSize + 1, p_offset: page * pageSize });
  return { rows: rows.slice(0, pageSize), more: rows.length > pageSize, page };
}

export default function Audit({ loaderData: { rows, more, page } }: Route.ComponentProps) {
  return (
    <Page>
      <PageHeader
        title="Audit log"
        description="Everything the staff did or opened, newest first. It can't be edited or deleted, by anyone."
      />
      {rows.length === 0 ? (
        <Nothing title="Nothing yet" />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="pr-4">Why</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="pl-4">
                    <TimeAgo value={a.created_at} exact />
                  </TableCell>
                  <TableCell>{a.actor}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {a.action}
                    </Badge>
                    {a.target && <span className="ml-2 font-mono text-xs text-muted-foreground">{a.target.slice(0, 18)}</span>}
                  </TableCell>
                  <TableCell>{a.user_id ? <PersonLink person={a.person} showHold={false} /> : null}</TableCell>
                  <TableCell className="max-w-80 pr-4 whitespace-normal text-muted-foreground">
                    {a.reason}
                    {Object.keys(a.details ?? {}).length > 0 && (
                      <span className="ml-1 font-mono text-xs">
                        {Object.entries(a.details)
                          .map(([k, v]) => `${k}: ${v ?? "none"}`)
                          .join(", ")}
                      </span>
                    )}
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

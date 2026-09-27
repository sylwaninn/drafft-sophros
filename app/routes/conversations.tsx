import { Link, useSearchParams } from "react-router";
import { ArrowRightIcon, MessagesSquareIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "~/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Nothing, Page, PageHeader, PersonLink, TimeAgo } from "~/components/app/bits";
import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
import type { MatchRow } from "~/lib/types";
import type { Route } from "./+types/conversations";

const pageSize = 60;

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const page = Math.max(0, Number(url.searchParams.get("page")) || 0);
  const user = url.searchParams.get("user");
  const rows = await query<MatchRow[]>(context.get(staffContext), "admin_matches", {
    p_user: user && /^[0-9a-f-]{36}$/i.test(user) ? user : null,
    p_limit: pageSize + 1,
    p_offset: page * pageSize,
  });
  return { rows: rows.slice(0, pageSize), more: rows.length > pageSize, page };
}

export default function Conversations({ loaderData: { rows, more, page } }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const user = params.get("user");
  const at = (p: number) => `?${new URLSearchParams({ ...(user ? { user } : {}), ...(p > 0 ? { page: String(p) } : {}) })}`;
  return (
    <Page>
      <PageHeader
        title="Conversations"
        description="Every match, newest first. Opening a conversation asks why and writes it to both accounts' trail: open one for a report, a hold or an investigation."
        actions={
          user && (
            <Button variant="outline" size="sm" asChild>
              <Link to="?" viewTransition>
                Show everyone's
              </Link>
            </Button>
          )
        }
      />
      {rows.length === 0 ? (
        <Nothing icon={<MessagesSquareIcon />} title="No match" />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Between</TableHead>
                <TableHead />
                <TableHead>Matched</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead className="pr-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="pl-4">
                    <PersonLink person={m.a} />
                  </TableCell>
                  <TableCell>
                    <PersonLink person={m.b} />
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <TimeAgo value={m.createdAt} />
                      {m.endedAt && <Badge variant="outline">Ended</Badge>}
                    </span>
                  </TableCell>
                  <TableCell>{m.sessions || <span className="text-muted-foreground">None</span>}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/conversations/${m.id}`} viewTransition>
                        Open
                        <ArrowRightIcon data-icon="inline-end" />
                      </Link>
                    </Button>
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
              <PaginationPrevious to={at(page - 1)} aria-disabled={page === 0} className={page === 0 ? "pointer-events-none opacity-50" : undefined} />
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

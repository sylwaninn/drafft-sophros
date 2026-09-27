import { Link, useSearchParams } from "react-router";
import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
import type { MatchRow } from "~/lib/types";
import { Badge, Card, Empty, Page, PersonLink, Table, Time } from "~/components/ui";
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
  const at = (p: number) => `?${new URLSearchParams({ ...(user ? { user } : {}), ...(p ? { page: String(p) } : {}) })}`;
  return (
    <Page
      title="Conversations"
      subtitle="Every match, newest first. Reading one asks why and goes to the audit log: open a conversation for a report, a hold or an investigation."
    >
      <Card>
        {rows.length === 0 ? (
          <Empty>No match.</Empty>
        ) : (
          <Table head={["Between", "", "Matched", "Sessions", ""]}>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>
                  <PersonLink person={m.a} size={22} />
                </td>
                <td>
                  <PersonLink person={m.b} size={22} />
                </td>
                <td>
                  <Time value={m.createdAt} />
                  {m.endedAt && (
                    <span className="ml-2">
                      <Badge>ended</Badge>
                    </span>
                  )}
                </td>
                <td>{m.sessions || ""}</td>
                <td className="text-right">
                  <Link to={`/conversations/${m.id}`} className="underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <div className="mt-3 flex justify-between text-sm">
        {page > 0 ? <Link to={at(page - 1)}>← Newer</Link> : <span />}
        {more && <Link to={at(page + 1)}>Older →</Link>}
      </div>
    </Page>
  );
}

import { Link } from "react-router";
import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
import type { AuditEntry } from "~/lib/types";
import { Card, Empty, Mono, Page, PersonLink, Table, Time } from "~/components/ui";
import type { Route } from "./+types/audit";

const pageSize = 100;

export async function loader({ request, context }: Route.LoaderArgs) {
  const page = Math.max(0, Number(new URL(request.url).searchParams.get("page")) || 0);
  const rows = await query<AuditEntry[]>(context.get(staffContext), "admin_audit", { p_limit: pageSize + 1, p_offset: page * pageSize });
  return { rows: rows.slice(0, pageSize), more: rows.length > pageSize, page };
}

export default function Audit({ loaderData: { rows, more, page } }: Route.ComponentProps) {
  return (
    <Page title="Audit log" subtitle="Everything the staff did or opened, newest first. It can't be edited or deleted.">
      <Card>
        {rows.length === 0 ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          <Table head={["When", "Who", "What", "Account", "About", "Why"]}>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  <Time value={a.created_at} exact />
                </td>
                <td>{a.actor}</td>
                <td>
                  <Mono>{a.action}</Mono>
                </td>
                <td>{a.user_id ? <PersonLink person={a.person} size={20} showHold={false} /> : null}</td>
                <td className="max-w-40 truncate text-xs text-mute" title={a.target ?? ""}>
                  {a.target}
                  {Object.keys(a.details ?? {}).length > 0 && <span className="ml-1">{JSON.stringify(a.details)}</span>}
                </td>
                <td className="text-body">{a.reason}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <div className="mt-3 flex justify-between text-sm">
        {page > 0 ? <Link to={`?page=${page - 1}`}>← Newer</Link> : <span />}
        {more && <Link to={`?page=${page + 1}`}>Older →</Link>}
      </div>
    </Page>
  );
}

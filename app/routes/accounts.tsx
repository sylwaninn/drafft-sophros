import { Form, Link, useSearchParams } from "react-router";
import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
import type { UserRow } from "~/lib/types";
import { inputClass } from "~/components/actions";
import { Avatar, Badge, Card, Empty, HoldBadge, Page, Table, Tabs, Time } from "~/components/ui";
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
  ["premium", "drafft tempo"],
  ["active", "Recently active"],
] as const;

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const page = Math.max(0, Number(url.searchParams.get("page")) || 0);
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
  const q = params.get("q") ?? "";
  const filter = params.get("filter") ?? "all";
  const link = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "" || v === 0) next.delete(k);
      else next.set(k, String(v));
    }
    const s = next.toString();
    return s ? `?${s}` : "?";
  };

  return (
    <Page title="Accounts" subtitle="Search by name, email, phone digits or account id.">
      <Form method="get" className="mb-4 flex gap-2">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <input name="q" defaultValue={q} type="search" placeholder="Name, email, phone or id" className={`${inputClass} max-w-md`} autoFocus={!q} />
      </Form>
      <Tabs items={filters.map(([value, label]) => ({ label, to: link({ filter: value === "all" ? null : value, page: null }), active: filter === value }))} />
      <Card>
        {rows.length === 0 ? (
          <Empty>No account matches.</Empty>
        ) : (
          <Table head={["Account", "Contact", "Status", "Signed up", "Last active", "Last opened", "30 days"]}>
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-soft/60">
                <td>
                  <Link to={`/accounts/${u.id}`} className="flex items-center gap-2 font-medium hover:underline">
                    <Avatar photo={u.photo} name={u.name} />
                    {u.name || <span className="text-mute">no name yet</span>}
                  </Link>
                </td>
                <td className="text-body">
                  <div className="max-w-56 truncate">{u.email}</div>
                  {u.phone && <div className="text-xs text-mute">+{u.phone}</div>}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <HoldBadge hold={u.moderation} />
                    {u.paused && !u.moderation && <Badge>Paused</Badge>}
                    {!u.onboarded_at && <Badge>Onboarding</Badge>}
                    {u.premium && <Badge tone="lime">tempo</Badge>}
                  </div>
                </td>
                <td>
                  <Time value={u.created_at} />
                </td>
                <td>
                  <Time value={u.last_active_at} />
                </td>
                <td>
                  <Time value={u.last_opened_at} />
                </td>
                <td className="whitespace-nowrap text-xs">
                  {u.flags > 0 && <Badge tone="warning">{u.flags} flagged</Badge>} {u.reports > 0 && <Badge tone="negative">{u.reports} reports</Badge>}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <div className="mt-3 flex justify-between text-sm">
        {page > 0 ? <Link to={link({ page: page - 1 })}>← Newer</Link> : <span />}
        {more && <Link to={link({ page: page + 1 })}>Older →</Link>}
      </div>
    </Page>
  );
}

import { useState } from "react";
import { useSearchParams } from "react-router";
import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
import type { Flag, Person } from "~/lib/types";
import { ActForm, Button } from "~/components/actions";
import { Badge, Card, Empty, MediaTile, Page, PersonLink, Table, Tabs, Time, cx } from "~/components/ui";
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
    query<FlaggedUser[]>(staff, "admin_flagged_users", { p_limit: 30 }),
  ]);
  return { flags, users };
}

export default function Flags({ loaderData: { flags, users } }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const all = params.get("status") === "all";
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const open = flags.filter((f) => !f.reviewed_at);
  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Page
      title="Flagged media"
      subtitle="Chat and profile photos the silent check found against the guidelines (red) or borderline (yellow). Nobody was told."
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              items={[
                { label: "To look at", to: "?", active: !all },
                { label: "All", to: "?status=all", active: all },
              ]}
            />
            {open.length > 0 && (
              <ActForm intent="flags" fields={{ id: [...selected].map(String) }} className="mb-4 flex items-center gap-2">
                {({ pending }) => (
                  <>
                    <button type="button" className="text-sm text-body underline" onClick={() => setSelected(selected.size ? new Set() : new Set(open.map((f) => f.id)))}>
                      {selected.size ? "Clear" : "Select all"}
                    </button>
                    <Button tone="primary" pending={pending} disabled={!selected.size} onClick={() => setTimeout(() => setSelected(new Set()))}>
                      Looked at {selected.size || ""}
                    </Button>
                  </>
                )}
              </ActForm>
            )}
          </div>
          {flags.length === 0 ? (
            <Card>
              <Empty>Nothing flagged to look at.</Empty>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {flags.map((f) => (
                <div
                  key={f.id}
                  className={cx("rounded-xl border bg-canvas p-2", selected.has(f.id) ? "border-ink ring-1 ring-ink" : "border-line")}
                >
                  <MediaTile mediaKey={f.key} />
                  <div className="mt-2 space-y-1 text-xs">
                    <PersonLink person={f.person} size={20} />
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge tone={f.verdict === "rejected" ? "negative" : "warning"}>{f.context}</Badge>
                      <Time value={f.created_at} />
                      {(f.userFlags30d ?? 0) > 1 && <Badge>{f.userFlags30d} in 30 d</Badge>}
                    </div>
                    <p className="text-mute">{f.labels.slice(0, 3).join(", ")}</p>
                    {f.reviewed_at ? (
                      <p className="text-mute">looked at by {f.reviewed_by}</p>
                    ) : (
                      <label className="flex items-center gap-1.5 pt-1 text-body">
                        <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} />
                        select
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Card title="Most flagged, 30 days" className="lg:self-start">
          {users.length === 0 ? (
            <Empty>Nobody.</Empty>
          ) : (
            <Table head={["Account", "Flags", "Chat"]}>
              {users.map((u) => (
                <tr key={u.person.id}>
                  <td>
                    <PersonLink person={u.person} size={20} />
                  </td>
                  <td>
                    {u.flags} {u.rejected > 0 && <span className="text-negative-deep">({u.rejected} red)</span>}
                  </td>
                  <td>{u.inChats}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </Page>
  );
}

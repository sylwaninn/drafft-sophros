import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
import { ActForm, Button, inputClass } from "~/components/actions";
import { Badge, Card, Page, Table, Time, useRoot } from "~/components/ui";
import type { Route } from "./+types/staff";

interface Member {
  email: string;
  role: "support" | "moderator" | "admin";
  created_at: string;
  created_by: string | null;
  last_seen_at: string | null;
  disabled_at: string | null;
}

export async function loader({ context }: Route.LoaderArgs) {
  return { members: await query<Member[]>(context.get(staffContext), "admin_staff_list") };
}

const roles = [
  ["support", "Support: accounts, support, reports (read), notes"],
  ["moderator", "Moderator: + holds, photos, flags, reports, conversations, selfies"],
  ["admin", "Admin: + lifting bans, staff, the whole audit log"],
] as const;

export default function Staff({ loaderData: { members } }: Route.ComponentProps) {
  const { staff, env } = useRoot();
  return (
    <Page
      title="Staff"
      subtitle={`Who can open sophros ${env}. Each environment has its own list; Cloudflare Access must let them in too.`}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card>
          <Table head={["Email", "Role", "Added", "Last seen", ""]}>
            {members.map((m) => (
              <tr key={m.email} className={m.disabled_at ? "opacity-50" : undefined}>
                <td className="font-medium">
                  {m.email} {m.email === staff.email && <Badge>you</Badge>}
                </td>
                <td>{m.disabled_at ? <Badge>disabled</Badge> : <Badge tone={m.role === "admin" ? "ink" : m.role === "moderator" ? "lime" : "neutral"}>{m.role}</Badge>}</td>
                <td className="text-xs text-mute">
                  <Time value={m.created_at} />
                  {m.created_by && <> by {m.created_by}</>}
                </td>
                <td>
                  <Time value={m.last_seen_at} />
                </td>
                <td className="text-right">
                  {m.email !== staff.email && (
                    <ActForm intent="staff" fields={{ email: m.email }} className="flex justify-end gap-1">
                      {({ pending }) => (
                        <>
                          <select name="role" defaultValue={m.disabled_at ? "" : m.role} className={`${inputClass} w-32 py-1 text-xs`} aria-label={`Role of ${m.email}`}>
                            <option value="support">support</option>
                            <option value="moderator">moderator</option>
                            <option value="admin">admin</option>
                            <option value="">disabled</option>
                          </select>
                          <Button pending={pending} className="py-1 text-xs">
                            Save
                          </Button>
                        </>
                      )}
                    </ActForm>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Add someone" className="lg:self-start">
          <ActForm intent="staff" resetOnSuccess className="space-y-2">
            {({ pending }) => (
              <>
                <input name="email" type="email" required placeholder="Their email, as Access knows it" className={inputClass} />
                <select name="role" defaultValue="support" className={inputClass} aria-label="Role">
                  {roles.map(([value]) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <Button tone="primary" pending={pending}>
                  Add
                </Button>
              </>
            )}
          </ActForm>
          <ul className="mt-4 space-y-1 text-xs text-mute">
            {roles.map(([value, label]) => (
              <li key={value}>{label}</li>
            ))}
          </ul>
        </Card>
      </div>
    </Page>
  );
}

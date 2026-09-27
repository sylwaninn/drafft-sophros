import { useState } from "react";
import { UserPlusIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { useAct } from "~/components/app/act";
import { Page, PageHeader, TimeAgo } from "~/components/app/bits";
import { useRoot } from "~/components/app/root-data";
import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
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
  ["support", "Accounts, support, reports to read, notes"],
  ["moderator", "Plus holds, photos, flags, reports, conversations, selfies"],
  ["admin", "Plus lifting bans, the staff and the whole audit log"],
] as const;

function RoleSelect({ member }: { member: Member }) {
  const { fetcher } = useAct();
  const value = (fetcher.formData?.get("role") as string | undefined) ?? (member.disabled_at ? "disabled" : member.role);
  return (
    <Select
      value={value}
      onValueChange={(role) =>
        fetcher.submit({ intent: "staff", email: member.email, role: role === "disabled" ? "" : role }, { method: "post", action: "/act" })
      }
    >
      <SelectTrigger size="sm" className="w-36" aria-label={`Role of ${member.email}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="support">Support</SelectItem>
        <SelectItem value="moderator">Moderator</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="disabled">Disabled</SelectItem>
      </SelectContent>
    </Select>
  );
}

function AddStaff() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("support");
  const { fetcher, pending } = useAct({ onDone: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlusIcon data-icon="inline-start" />
          Add someone
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add someone to the staff</DialogTitle>
          <DialogDescription>They also need to be let in by Cloudflare Access for this environment.</DialogDescription>
        </DialogHeader>
        <fetcher.Form method="post" action="/act" className="grid gap-6">
          <input type="hidden" name="intent" value="staff" />
          <input type="hidden" name="role" value={role} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="staff-email">Email</FieldLabel>
              <Input id="staff-email" name="email" type="email" required placeholder="name@getdrafft.com" />
              <FieldDescription>The one their Access sign-in uses.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Role</FieldLabel>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(([value]) => (
                    <SelectItem key={value} value={value} className="capitalize">
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{roles.find(([v]) => v === role)?.[1]}</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Add
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Staff({ loaderData: { members } }: Route.ComponentProps) {
  const { staff, env } = useRoot();
  return (
    <Page>
      <PageHeader
        title="Staff"
        description={`Who can open sophros on ${env}, and with which role. Each environment has its own list.`}
        actions={<AddStaff />}
      />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="pr-4">Last seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.email} className={m.disabled_at ? "text-muted-foreground" : undefined}>
                <TableCell className="pl-4 font-medium">
                  {m.email} {m.email === staff.email && <Badge variant="secondary">You</Badge>}
                </TableCell>
                <TableCell>
                  {m.email === staff.email ? <Badge className="capitalize">{m.role}</Badge> : <RoleSelect member={m} />}
                </TableCell>
                <TableCell>
                  <TimeAgo value={m.created_at} />
                  {m.created_by && <span className="text-muted-foreground"> by {m.created_by}</span>}
                </TableCell>
                <TableCell className="pr-4">
                  <TimeAgo value={m.last_seen_at} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
        {roles.map(([value, label]) => (
          <p key={value}>
            <span className="font-medium text-foreground capitalize">{value}</span>: {label}.
          </p>
        ))}
      </div>
    </Page>
  );
}

import { useNavigate } from "react-router";
import { CheckIcon, FlagIcon, ScanFaceIcon, ShieldBanIcon, ShieldQuestionIcon, XIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Facts, MediaTile, Nothing, OverlayBadge, Page, PageHeader, Panel, PersonLink, TimeAgo } from "~/components/app/bits";
import { AccountPanel, ReviewStage, type AccountBrief } from "~/components/app/review-parts";
import { ReviewQueue, type ReviewAction } from "~/components/app/review-queue";
import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
import type { Flag as FlagRow, Person } from "~/lib/types";
import type { Route } from "./+types/flags";

interface Flag extends FlagRow {
  media: { id: string; status: string } | null;
  account: AccountBrief | null;
}

interface FlaggedUser {
  person: Person;
  flags: number;
  rejected: number;
  inChats: number;
  lastFlag: string;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const staff = context.get(staffContext);
  const history = new URL(request.url).searchParams.get("view") === "history";
  const [flags, users] = await Promise.all([
    query<Flag[]>(staff, "admin_flags", { p_open: !history, p_limit: history ? 120 : 200 }),
    history ? query<FlaggedUser[]>(staff, "admin_flagged_users", { p_limit: 20 }) : Promise.resolve([] as FlaggedUser[]),
  ]);
  return { flags, users, history };
}

const why = (f: Flag) => `flagged ${f.context} photo: ${f.labels.join(", ")}`;
const resolve = (f: Flag, reason?: string) => ({ intent: "flags" as const, ids: [f.id], reason });

const actions: ReviewAction<Flag>[] = [
  {
    id: "fine",
    key: "f",
    label: "Looks fine",
    icon: CheckIcon,
    tone: "approve",
    variant: "default",
    ops: (f) => [resolve(f, "looks fine")],
  },
  {
    id: "refuse",
    key: "r",
    label: "Refuse the photo",
    icon: XIcon,
    tone: "reject",
    available: (f) => !!f.media && f.media.status !== "rejected",
    ops: (f) => [{ intent: "media", media: f.media!.id, approved: false, reason: why(f) }, resolve(f, "photo refused")],
  },
  {
    id: "review",
    key: "h",
    label: "Hold for review",
    icon: ShieldQuestionIcon,
    tone: "hold",
    available: (f) => !!f.person && !f.person.deleted && f.person.moderation !== "banned",
    reason: why,
    ops: (f, reason) => [{ intent: "hold", user: f.person!.id, state: "review", reason }, resolve(f, "account held for review")],
  },
  {
    id: "selfie",
    key: "s",
    label: "Ask for a selfie",
    icon: ScanFaceIcon,
    tone: "hold",
    available: (f) => !!f.person && !f.person.deleted && f.person.moderation !== "banned",
    reason: why,
    ops: (f, reason) => [{ intent: "hold", user: f.person!.id, state: "selfie", reason }, resolve(f, "selfie asked")],
  },
  {
    id: "ban",
    key: "b",
    label: "Ban",
    icon: ShieldBanIcon,
    tone: "reject",
    available: (f) => !!f.person && !f.person.deleted && f.person.moderation !== "banned",
    prompt: {
      title: (f) => `Ban ${f.person?.name || "this account"}?`,
      description: "Closes the account for good: its email, phone and sign-ins can't come back.",
      destructive: true,
    },
    ops: (f, reason) => [
      ...(f.media && f.media.status !== "rejected" ? [{ intent: "media" as const, media: f.media.id, approved: false, reason }] : []),
      { intent: "hold", user: f.person!.id, state: "banned", reason },
      resolve(f, "account banned"),
    ],
  },
];

export default function Flags({ loaderData: { flags, users, history } }: Route.ComponentProps) {
  const navigate = useNavigate();
  return (
    <Page>
      <PageHeader
        title="Flagged media"
        description="Chat and profile photos the silent check found against the guidelines, or borderline. Nobody was told. Decide on each, then apply the batch."
        actions={
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={history ? "history" : "queue"}
            onValueChange={(v) => v && navigate(v === "history" ? "?view=history" : "?", { replace: true })}
          >
            <ToggleGroupItem value="queue">Queue</ToggleGroupItem>
            <ToggleGroupItem value="history">History</ToggleGroupItem>
          </ToggleGroup>
        }
      />
      {history ? (
        <History flags={flags} users={users} />
      ) : (
        <ReviewQueue
          items={flags}
          getId={(f) => String(f.id)}
          thumb={(f) => f.key}
          title={(f) => `${f.person?.name || "Deleted account"}, ${f.context} photo`}
          itemNoun="Flag"
          actions={actions}
          empty={{ title: "Nothing flagged to look at", description: "Photos the silent check catches land here." }}
          stage={(f) => (
            <ReviewStage mediaKey={f.key} caption={`${f.context} photo by ${f.person?.name ?? "a deleted account"}`}>
              <OverlayBadge tone={f.verdict === "rejected" ? "danger" : "neutral"}>
                {f.verdict === "rejected" ? "Against the guidelines" : "Borderline"}
              </OverlayBadge>
            </ReviewStage>
          )}
          aside={(f) => (
            <>
              <Panel title="What the check found">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-1.5">
                    {f.labels.map((l) => (
                      <Badge key={l} variant={f.verdict === "rejected" ? "destructive" : "secondary"}>
                        {l}
                      </Badge>
                    ))}
                  </div>
                  <Facts
                    rows={[
                      ["Where", f.context === "chat" ? "Sent in a chat" : "A profile photo"],
                      ["Verdict", f.verdict === "rejected" ? "Against the guidelines" : "Borderline"],
                      ["Flagged", <TimeAgo key="t" value={f.created_at} />],
                      ["Photo now", f.media ? <span key="m" className="capitalize">{f.media.status}</span> : f.context === "chat" ? "Delivered" : "Deleted"],
                    ]}
                  />
                </div>
              </Panel>
              <AccountPanel person={f.person ?? null} brief={f.account} highlight={f.key} />
            </>
          )}
        />
      )}
    </Page>
  );
}

function History({ flags, users }: { flags: Flag[]; users: FlaggedUser[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      {flags.length === 0 ? (
        <Nothing icon={<FlagIcon />} title="Nothing flagged yet" />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {flags.map((f, i) => (
            <div key={f.id} className="space-y-3">
              <MediaTile
                mediaKey={f.key}
                gallery={flags.map((x) => ({ key: x.key, caption: `${x.person?.name ?? "Someone"}, ${x.context}: ${x.labels.join(", ")}` }))}
                index={i}
                title="Flagged media"
                className="rounded-xl"
              >
                <OverlayBadge tone={f.verdict === "rejected" ? "danger" : "neutral"}>{f.context}</OverlayBadge>
              </MediaTile>
              <div className="space-y-1 px-0.5 text-sm">
                <PersonLink person={f.person} />
                <p className="text-xs text-muted-foreground">
                  {f.labels.slice(0, 3).join(", ")}
                  <br />
                  <TimeAgo value={f.created_at} />
                  {f.reviewed_at ? <>, looked at by {f.reviewed_by}</> : ", not looked at yet"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      <Panel title="Most flagged" description="Last 30 days" className="self-start" contentClassName="px-0">
        {users.length === 0 ? (
          <Nothing title="Nobody" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Account</TableHead>
                <TableHead className="text-right">Flags</TableHead>
                <TableHead className="pr-6 text-right">Chat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.person.id}>
                  <TableCell className="pl-6">
                    <PersonLink person={u.person} showHold={false} />
                  </TableCell>
                  <TableCell className="text-right">
                    {u.flags}
                    {u.rejected > 0 && <span className="text-destructive"> ({u.rejected})</span>}
                  </TableCell>
                  <TableCell className="pr-6 text-right">{u.inChats}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

import { Link, useNavigate } from "react-router";
import { CheckIcon, FlagIcon, MessagesSquareIcon, ScanFaceIcon, ShieldBanIcon, ShieldQuestionIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Facts, MediaTile, Nothing, OverlayBadge, Page, PageHeader, Panel, PersonLink, TimeAgo } from "~/components/app/bits";
import { AccountPanel, ReviewStage, type AccountBrief } from "~/components/app/review-parts";
import { ReviewQueue, type ReviewAction } from "~/components/app/review-queue";
import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
import type { Flag as FlagRow, Person } from "~/lib/types";
import type { Route } from "./+types/shared-media";

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
    query<Flag[]>(staff, "admin_flags", { p_open: !history, p_limit: history ? 120 : 200, p_context: "chat" }),
    history ? query<FlaggedUser[]>(staff, "admin_flagged_users", { p_limit: 20 }) : Promise.resolve([] as FlaggedUser[]),
  ]);
  return { flags, users, history };
}

const why = (f: Flag) => `photo shared in a chat: ${f.labels.join(", ")}`;
const holdable = (f: Flag) => !!f.person && !f.person.deleted && f.person.moderation !== "banned";

const actions: ReviewAction<Flag>[] = [
  {
    id: "fine",
    key: "n",
    label: "Nothing wrong",
    icon: CheckIcon,
    variant: "default",
    done: "Marked as fine.",
    decide: (f) => ({ intent: "flags", ids: [f.id], reason: "nothing wrong" }),
  },
  {
    id: "review",
    key: "h",
    label: "Hold for review",
    icon: ShieldQuestionIcon,
    available: holdable,
    reason: why,
    done: "Account held for review.",
    decide: (f, reason) => ({ intent: "flags", ids: [f.id], reason: "account held for review", hold: "review", holdReason: reason }),
  },
  {
    id: "selfie",
    key: "s",
    label: "Ask for a selfie",
    icon: ScanFaceIcon,
    available: holdable,
    reason: why,
    done: "Selfie asked: the account is frozen until they send it.",
    decide: (f, reason) => ({ intent: "flags", ids: [f.id], reason: "selfie asked", hold: "selfie", holdReason: reason }),
  },
  {
    id: "ban",
    key: "b",
    label: "Ban",
    icon: ShieldBanIcon,
    variant: "destructive",
    available: holdable,
    prompt: {
      title: (f) => `Ban ${f.person?.name || "this account"}?`,
      description: "Closes the account for good: its email, phone and sign-ins can't come back.",
      destructive: true,
    },
    done: "Account banned.",
    decide: (f, reason) => ({ intent: "flags", ids: [f.id], reason: "account banned", hold: "banned", holdReason: reason }),
  },
];

export default function SharedMedia({ loaderData: { flags, users, history } }: Route.ComponentProps) {
  const navigate = useNavigate();
  return (
    <Page>
      <PageHeader
        title="Shared media"
        description="Photos sent in chats that the silent check flagged. They were delivered and can't be unsent: decide what the sender's account needs. Nobody was told."
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
          title={(f) => `${f.person?.name || "Deleted account"}, photo sent in a chat`}
          itemNoun="Photo"
          actions={actions}
          empty={{ title: "No shared photo to look at", description: "Chat photos the silent check flags land here." }}
          extra={(f) =>
            f.person && !f.person.deleted ? (
              <Button variant="ghost" className="ml-auto" asChild>
                <Link to={`/conversations?user=${f.person.id}`}>
                  <MessagesSquareIcon data-icon="inline-start" />
                  Their conversations
                </Link>
              </Button>
            ) : null
          }
          stage={(f) => (
            <ReviewStage mediaKey={f.key} caption={`Photo sent by ${f.person?.name ?? "a deleted account"}`}>
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
                      ["Verdict", f.verdict === "rejected" ? "Against the guidelines" : "Borderline"],
                      ["Sent", <TimeAgo key="t" value={f.created_at} />],
                      ["Their flags, 30 days", String(f.userFlags30d ?? 1)],
                    ]}
                  />
                  <p className="text-sm text-muted-foreground">
                    Delivered to the person they wrote to; the check only records it. To see where it was sent, open their conversations.
                  </p>
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
        <Nothing icon={<FlagIcon />} title="No shared photo flagged yet" />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {flags.map((f, i) => (
            <div key={f.id} className="space-y-3">
              <MediaTile
                mediaKey={f.key}
                gallery={flags.map((x) => ({
                  key: x.key,
                  caption: `${x.person?.name ?? "Someone"}, ${x.context}: ${x.labels.join(", ")}`,
                }))}
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

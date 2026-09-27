import { CheckIcon, ShieldBanIcon, ShieldQuestionIcon, UndoIcon, XIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Facts, OverlayBadge, Page, PageHeader, Panel, TimeAgo } from "~/components/app/bits";
import { AccountPanel, ReviewStage, type AccountBrief } from "~/components/app/review-parts";
import { ReviewQueue, type ReviewAction } from "~/components/app/review-queue";
import { useRoot } from "~/components/app/root-data";
import { staffContext } from "~/lib/context";
import { can } from "~/lib/roles";
import { query } from "~/lib/.server/db";
import type { Person } from "~/lib/types";
import type { BatchOp } from "./act";
import type { Route } from "./+types/profile-photos";

interface ProfilePhoto {
  id: string;
  person: Person;
  kind: "photo" | "video";
  key: string;
  posterKey: string | null;
  position: number;
  createdAt: string;
  reviewRequestedAt: string | null;
  /** pending: waiting for a person; refused: the automatic check refused it, a person confirms. */
  state: "pending" | "refused";
  labels: string[] | null;
  flagIds: number[];
  account: AccountBrief | null;
}

export async function loader({ context }: Route.LoaderArgs) {
  return { photos: await query<ProfilePhoto[]>(context.get(staffContext), "admin_media_queue", { p_limit: 200 }) };
}

const labels = (m: ProfilePhoto) => (m.labels?.length ? m.labels.join(", ") : "no label");
const pending = (m: ProfilePhoto) => m.state === "pending";
const refused = (m: ProfilePhoto) => m.state === "refused";
const holdable = (m: ProfilePhoto) => m.person.moderation !== "banned";
/** A pending photo is refused with the account decision; an already refused one only has its flags closed. */
const settle = (m: ProfilePhoto, reason: string): BatchOp[] =>
  pending(m) ? [{ intent: "media", media: m.id, approved: false, reason }] : m.flagIds.length ? [{ intent: "flags", ids: m.flagIds, reason }] : [];

const actions: ReviewAction<ProfilePhoto>[] = [
  {
    id: "approve",
    key: "a",
    label: "Approve",
    icon: CheckIcon,
    variant: "default",
    available: pending,
    done: "Photo approved: it's on their profile.",
    ops: (m) => [{ intent: "media", media: m.id, approved: true }],
  },
  {
    id: "refuse",
    key: "r",
    label: "Refuse",
    icon: XIcon,
    available: pending,
    done: "Photo refused: they can ask for a second look.",
    ops: (m) => [{ intent: "media", media: m.id, approved: false }],
  },
  {
    id: "keep",
    key: "k",
    label: "Keep refused",
    icon: CheckIcon,
    variant: "default",
    available: refused,
    done: "Refusal confirmed.",
    ops: (m) => [{ intent: "flags", ids: m.flagIds, reason: "refusal confirmed" }],
  },
  {
    id: "restore",
    key: "a",
    label: "Approve anyway",
    icon: UndoIcon,
    available: refused,
    done: "Photo restored: it's on their profile.",
    ops: (m) => [{ intent: "media", media: m.id, approved: true, reason: "the automatic refusal was wrong" }],
  },
  {
    id: "hold",
    key: "h",
    label: "Refuse and hold the account",
    icon: ShieldQuestionIcon,
    available: holdable,
    reason: (m) => `profile photo refused: ${labels(m)}`,
    done: "Photo refused, account held for review.",
    ops: (m, reason) => [...settle(m, reason), { intent: "hold", user: m.person.id, state: "review", reason }],
  },
  {
    id: "ban",
    key: "b",
    label: "Refuse and ban",
    icon: ShieldBanIcon,
    variant: "destructive",
    available: holdable,
    prompt: {
      title: (m) => `Ban ${m.person.name || "this account"}?`,
      description: "The photo stays refused and the account is closed: its email, phone and sign-ins can't come back.",
      destructive: true,
    },
    done: "Photo refused, account banned.",
    ops: (m, reason) => [...settle(m, reason), { intent: "hold", user: m.person.id, state: "banned", reason }],
  },
];

export default function ProfilePhotos({ loaderData: { photos } }: Route.ComponentProps) {
  const { staff } = useRoot();
  return (
    <Page>
      <PageHeader
        title="Profile photos"
        description="Photos on profiles that need a person: ones the automatic check couldn't decide on, second looks asked for, and ones it refused on its own."
      />
      <ReviewQueue
        items={photos}
        getId={(m) => m.id}
        title={(m) => (
          <span className="flex items-center gap-2">
            {m.person.name || "No name yet"}, photo {m.position + 1}
            {refused(m) ? <Badge variant="destructive">Refused automatically</Badge> : m.reviewRequestedAt ? <Badge>Second look asked</Badge> : <Badge variant="secondary">Borderline</Badge>}
          </span>
        )}
        itemNoun="Photo"
        actions={can(staff, "moderator") ? actions : []}
        empty={{ title: "No profile photo to review", description: "Photos the automatic check can't settle land here." }}
        stage={(m) => (
          <ReviewStage mediaKey={m.key} kind={m.kind} posterKey={m.posterKey} caption={`${m.person.name}'s profile photo`}>
            <OverlayBadge tone={refused(m) ? "danger" : "neutral"}>{refused(m) ? "Hidden from others" : "Not visible yet"}</OverlayBadge>
          </ReviewStage>
        )}
        aside={(m) => (
          <>
            <Panel title="Why it's here">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {refused(m)
                    ? "The automatic check refused it: it's hidden from everyone. Keep the refusal, or approve it if the check was wrong."
                    : m.reviewRequestedAt
                      ? "It was refused and they asked a person to look again. Nobody sees it until it's approved."
                      : "The automatic check couldn't decide. Nobody sees it until it's approved."}
                </p>
                {m.labels?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {m.labels.map((l) => (
                      <Badge key={l} variant={refused(m) ? "destructive" : "secondary"}>
                        {l}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <Facts
                  rows={[
                    ["Uploaded", <TimeAgo key="u" value={m.createdAt} />],
                    ["Second look", m.reviewRequestedAt ? <TimeAgo key="r" value={m.reviewRequestedAt} /> : null],
                    ["Position", `Photo ${m.position + 1} on the profile`],
                  ]}
                />
              </div>
            </Panel>
            <AccountPanel person={m.person} brief={m.account} highlight={m.posterKey ?? m.key} />
          </>
        )}
      />
    </Page>
  );
}

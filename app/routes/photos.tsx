import { CheckIcon, ShieldBanIcon, ShieldQuestionIcon, XIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Page, PageHeader, Panel, Facts, TimeAgo, OverlayBadge } from "~/components/app/bits";
import { AccountPanel, ReviewStage, type AccountBrief } from "~/components/app/review-parts";
import { ReviewQueue, type ReviewAction } from "~/components/app/review-queue";
import { useRoot } from "~/components/app/root-data";
import { staffContext } from "~/lib/context";
import { can } from "~/lib/roles";
import { query } from "~/lib/.server/db";
import type { Person } from "~/lib/types";
import type { Route } from "./+types/photos";

interface Pending {
  id: string;
  person: Person;
  kind: "photo" | "video";
  key: string;
  posterKey: string | null;
  position: number;
  createdAt: string;
  reviewRequestedAt: string | null;
  labels: string[] | null;
  account: AccountBrief | null;
}

export async function loader({ context }: Route.LoaderArgs) {
  return { media: await query<Pending[]>(context.get(staffContext), "admin_media_queue", { p_limit: 200 }) };
}

const labels = (m: Pending) => (m.labels?.length ? m.labels.join(", ") : "no label");

const actions: ReviewAction<Pending>[] = [
  {
    id: "approve",
    key: "a",
    label: "Approve",
    icon: CheckIcon,
    tone: "approve",
    variant: "default",
    ops: (m) => [{ intent: "media", media: m.id, approved: true }],
  },
  {
    id: "refuse",
    key: "r",
    label: "Refuse",
    icon: XIcon,
    tone: "reject",
    ops: (m) => [{ intent: "media", media: m.id, approved: false }],
  },
  {
    id: "hold",
    key: "h",
    label: "Refuse and hold for review",
    icon: ShieldQuestionIcon,
    tone: "hold",
    reason: (m) => `refused photo: ${labels(m)}`,
    ops: (m, reason) => [
      { intent: "media", media: m.id, approved: false, reason },
      { intent: "hold", user: m.person.id, state: "review", reason },
    ],
  },
  {
    id: "ban",
    key: "b",
    label: "Refuse and ban",
    icon: ShieldBanIcon,
    tone: "reject",
    variant: "outline",
    available: (m) => m.person.moderation !== "banned",
    prompt: {
      title: (m) => `Ban ${m.person.name || "this account"}?`,
      description: "The photo is refused and the account closed: its email, phone and sign-ins can't come back.",
      destructive: true,
    },
    ops: (m, reason) => [
      { intent: "media", media: m.id, approved: false, reason },
      { intent: "hold", user: m.person.id, state: "banned", reason },
    ],
  },
];

export default function Photos({ loaderData: { media } }: Route.ComponentProps) {
  const { staff } = useRoot();
  return (
    <Page>
      <PageHeader
        title="Photo reviews"
        description="Profile photos the automatic check left to a person: second looks asked for first, then borderline ones. Approved photos go live when the batch is applied."
      />
      <ReviewQueue
        items={media}
        getId={(m) => m.id}
        thumb={(m) => m.posterKey ?? m.key}
        title={(m) => `${m.person.name || "No name yet"}, photo ${m.position + 1}`}
        itemNoun="Photo"
        actions={can(staff, "moderator") ? actions : []}
        empty={{ title: "Nothing to review", description: "Photos the automatic check can't decide on land here." }}
        stage={(m) => (
          <ReviewStage mediaKey={m.key} kind={m.kind} posterKey={m.posterKey} caption={`${m.person.name}'s photo`}>
            <OverlayBadge>{m.reviewRequestedAt ? "Second look asked" : "Borderline"}</OverlayBadge>
          </ReviewStage>
        )}
        aside={(m) => (
          <>
            <Panel title="Why it's here">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {m.reviewRequestedAt
                    ? "It was refused, and they asked for a person to look again."
                    : "The automatic check couldn't decide: borderline labels, or too large to check."}
                </p>
                {m.labels?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {m.labels.map((l) => (
                      <Badge key={l} variant="secondary">
                        {l}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <Facts
                  rows={[
                    ["Uploaded", <TimeAgo key="u" value={m.createdAt} />],
                    ["Second look", m.reviewRequestedAt ? <TimeAgo key="r" value={m.reviewRequestedAt} /> : null],
                    ["Kind", m.kind],
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

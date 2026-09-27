import { CheckIcon, XIcon } from "lucide-react";
import { ActButton } from "~/components/app/act";
import { MediaTile, Nothing, OverlayBadge, Page, PageHeader, PersonLink, TimeAgo } from "~/components/app/bits";
import { QueueItem, QueueMotion } from "~/components/app/motion";
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
  createdAt: string;
  reviewRequestedAt: string | null;
  labels: string[] | null;
}

export async function loader({ context }: Route.LoaderArgs) {
  return { media: await query<Pending[]>(context.get(staffContext), "admin_media_queue", { p_limit: 120 }) };
}

export default function Photos({ loaderData: { media } }: Route.ComponentProps) {
  const { staff } = useRoot();
  const moderator = can(staff, "moderator");
  return (
    <Page>
      <PageHeader
        title="Photo reviews"
        description="Profile photos the automatic check left to a person: second looks asked for first, then borderline ones. Approved photos go live at once."
      />
      {media.length === 0 ? (
        <Nothing title="Nothing to review">Photos the check can't decide on land here.</Nothing>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <QueueMotion>
            {media.map((m) => (
              <QueueItem key={m.id} id={m.id} className="space-y-3">
                <MediaTile
                  mediaKey={m.key}
                  kind={m.kind}
                  posterKey={m.posterKey}
                  title={`${m.person.name || "Photo"}, waiting for review`}
                  className="rounded-xl"
                >
                  <OverlayBadge>{m.reviewRequestedAt ? "Second look" : "Borderline"}</OverlayBadge>
                </MediaTile>
                <div className="space-y-1 px-0.5 text-sm">
                  <PersonLink person={m.person} showHold={false} />
                  <p className="text-xs text-muted-foreground">
                    {m.labels?.length ? m.labels.join(", ") : "No label"}, <TimeAgo value={m.reviewRequestedAt ?? m.createdAt} />
                  </p>
                </div>
                {moderator ? (
                  <div className="flex gap-2">
                    <ActButton intent="media" fields={{ media: m.id, approved: "false" }} variant="outline" size="sm" className="flex-1">
                      <XIcon data-icon="inline-start" />
                      Refuse
                    </ActButton>
                    <ActButton intent="media" fields={{ media: m.id, approved: "true" }} size="sm" className="flex-1">
                      <CheckIcon data-icon="inline-start" />
                      Approve
                    </ActButton>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Moderators decide.</p>
                )}
              </QueueItem>
            ))}
          </QueueMotion>
        </div>
      )}
    </Page>
  );
}

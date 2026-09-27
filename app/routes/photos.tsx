import { staffContext } from "~/lib/context";
import { can } from "~/lib/roles";
import { query } from "~/lib/.server/db";
import type { Person } from "~/lib/types";
import { ActForm, Button } from "~/components/actions";
import { Badge, Card, Empty, MediaTile, Page, PersonLink, Time, useRoot } from "~/components/ui";
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
    <Page
      title="Photo reviews"
      subtitle="Profile photos and videos the automatic check left for a person: second looks asked for first, then borderline ones."
    >
      {media.length === 0 ? (
        <Card>
          <Empty>Nothing to review.</Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {media.map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <MediaTile mediaKey={m.key} kind={m.kind} posterKey={m.posterKey} />
              <div className="mt-2 space-y-1.5 text-xs">
                <PersonLink person={m.person} size={20} />
                <div className="flex flex-wrap items-center gap-1">
                  {m.reviewRequestedAt ? <Badge tone="cyan">second look asked</Badge> : <Badge tone="warning">borderline</Badge>}
                  <Time value={m.reviewRequestedAt ?? m.createdAt} />
                </div>
                {m.labels && m.labels.length > 0 && <p className="text-mute">{m.labels.join(", ")}</p>}
                {moderator && (
                  <div className="flex gap-1.5 pt-1">
                    <ActForm intent="media" fields={{ media: m.id, approved: "true" }} className="flex-1">
                      {({ pending }) => (
                        <Button tone="lime" pending={pending} className="w-full">
                          Approve
                        </Button>
                      )}
                    </ActForm>
                    <ActForm intent="media" fields={{ media: m.id, approved: "false" }} className="flex-1">
                      {({ pending }) => (
                        <Button pending={pending} className="w-full">
                          Refuse
                        </Button>
                      )}
                    </ActForm>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}

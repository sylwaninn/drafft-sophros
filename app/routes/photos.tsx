import { CheckIcon, XIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { ActButton } from "~/components/app/act";
import { MediaTile, Nothing, Page, PageHeader, PersonLink, TimeAgo } from "~/components/app/bits";
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <QueueMotion>
            {media.map((m) => (
              <QueueItem key={m.id} id={m.id}>
                <Card className="gap-3 overflow-hidden pt-0">
                  <MediaTile mediaKey={m.key} kind={m.kind} posterKey={m.posterKey} className="rounded-none">
                    <Badge variant="secondary" className="absolute top-2 left-2 backdrop-blur">
                      {m.reviewRequestedAt ? "Second look" : "Borderline"}
                    </Badge>
                  </MediaTile>
                  <CardHeader className="px-3">
                    <CardTitle className="text-sm">
                      <PersonLink person={m.person} showHold={false} />
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {m.labels?.length ? m.labels.join(", ") : "No label"}, <TimeAgo value={m.reviewRequestedAt ?? m.createdAt} />
                    </CardDescription>
                  </CardHeader>
                  {moderator && (
                    <CardFooter className="gap-2 px-3">
                      <ActButton intent="media" fields={{ media: m.id, approved: "false" }} variant="outline" size="sm" className="flex-1">
                        <XIcon data-icon="inline-start" />
                        Refuse
                      </ActButton>
                      <ActButton intent="media" fields={{ media: m.id, approved: "true" }} size="sm" className="flex-1">
                        <CheckIcon data-icon="inline-start" />
                        Approve
                      </ActButton>
                    </CardFooter>
                  )}
                  {!moderator && <CardContent className="px-3 text-xs text-muted-foreground">Moderators decide.</CardContent>}
                </Card>
              </QueueItem>
            ))}
          </QueueMotion>
        </div>
      )}
    </Page>
  );
}

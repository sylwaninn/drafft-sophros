import { Link, useNavigate, useSearchParams } from "react-router";
import { CameraIcon, ChevronRightIcon, ScanFaceIcon, UserRoundSearchIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "~/components/ui/item";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { HoldControls } from "~/components/app/act";
import { Nothing, Page, PageHeader, PersonAvatar, PersonLink, TimeAgo } from "~/components/app/bits";
import { SelfieCompare } from "~/components/app/selfie-compare";
import { QueueItem, QueueMotion } from "~/components/app/motion";
import { useRoot } from "~/components/app/root-data";
import { staffContext } from "~/lib/context";
import { can } from "~/lib/roles";
import { query, signedUrl } from "~/lib/.server/db";
import { frontIndex, revalidateOnNewRead, selfieCaseShown } from "~/lib/audited-reads";
import type { Person } from "~/lib/types";
import type { Route } from "./+types/verifications";

interface Cause {
  note: string | null;
  actor: string | null;
  at: string;
}

interface Queue {
  selfies: { person: Person; selfieAt: string; cause: Cause | null; since: string; photos: { key: string; status: string }[] }[];
  reviews: { person: Person; cause: Cause | null; since: string }[];
  waitingSelfie: { person: Person; cause: Cause | null; since: string }[];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const staff = context.get(staffContext);
  const queue = await query<Queue>(staff, "admin_verifications");
  // A selfie is shown to moderators only, through a 5-minute link, and each showing is logged: only
  // the case in front on the selfies tab is signed, not the ones waiting behind it.
  const url = new URL(request.url);
  const picked = selfieCaseShown(url);
  const front = picked === null ? undefined : queue.selfies[frontIndex(queue.selfies, picked)];
  let selfie: { user: string; url: string | null } | null = null;
  if (front && can(staff, "moderator")) {
    const paths = await query<{ path: string; createdAt: string }[]>(staff, "admin_selfies", {
      p_user: front.person.id,
      p_reason: "verification queue",
    });
    selfie = { user: front.person.id, url: paths[0] ? await signedUrl("verification-selfies", paths[0].path) : null };
  }
  return { queue, selfie };
}

// Moving between tabs doesn't read the queue again, nor log a selfie nobody is shown.
export const shouldRevalidate = revalidateOnNewRead(selfieCaseShown);

function cause(c: Cause | null) {
  if (!c) return "No reason recorded";
  return `${c.note ?? "No reason recorded"}${c.actor ? `, by ${c.actor}` : ", automatic"}`;
}

export default function Verifications({ loaderData: { queue, selfie } }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tab = params.get("tab") ?? "selfies";
  return (
    <Page>
      <PageHeader title="Verifications" description="Accounts on hold waiting for a person, oldest first." />
      <Tabs value={tab} onValueChange={(t) => navigate(t === "selfies" ? "?" : `?tab=${t}`, { replace: true, preventScrollReset: true })}>
        <TabsList>
          <TabsTrigger value="selfies">
            <ScanFaceIcon />
            Selfies to compare
            <Badge variant="secondary">{queue.selfies.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="reviews">
            <UserRoundSearchIcon />
            In review
            <Badge variant="secondary">{queue.reviews.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="owed">
            <CameraIcon />
            Selfies owed
            <Badge variant="secondary">{queue.waitingSelfie.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="selfies" className="mt-4 space-y-6">
          {queue.selfies.length === 0 ? (
            <Nothing title="No selfie to compare">When someone sends the selfie they owe, it lands here.</Nothing>
          ) : (
            <SelfieQueue queue={queue} selfie={selfie} focus={params.get("case")} />
          )}
        </TabsContent>

        <TabsContent value="reviews" className="mt-4">
          {queue.reviews.length === 0 ? (
            <Nothing title="Nobody in review" />
          ) : (
            <ItemGroup className="gap-3">
              <QueueMotion>
                {queue.reviews.map((r) => (
                  <QueueItem key={r.person.id} id={r.person.id}>
                    <Item variant="outline">
                      <ItemContent>
                        <ItemTitle>
                          <PersonLink person={r.person} showHold={false} />
                        </ItemTitle>
                        <ItemDescription>
                          {cause(r.cause)}. Held <TimeAgo value={r.since} />.
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <HoldControls user={r.person.id} name={r.person.name ?? ""} current="review" size="sm" />
                      </ItemActions>
                    </Item>
                  </QueueItem>
                ))}
              </QueueMotion>
            </ItemGroup>
          )}
        </TabsContent>

        <TabsContent value="owed" className="mt-4">
          {queue.waitingSelfie.length === 0 ? (
            <Nothing title="Nobody owes a selfie" />
          ) : (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Account</TableHead>
                    <TableHead>Why it was asked</TableHead>
                    <TableHead className="pr-4 text-right">Asked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.waitingSelfie.map((w) => (
                    <TableRow key={w.person.id}>
                      <TableCell className="pl-4">
                        <PersonLink person={w.person} showHold={false} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{cause(w.cause)}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <TimeAgo value={w.since} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </Page>
  );
}

/** The case in front (the oldest, or the one picked), and the ones waiting after it. */
function SelfieQueue({
  queue,
  selfie,
  focus,
}: {
  queue: Queue;
  selfie: { user: string; url: string | null } | null;
  focus: string | null;
}) {
  const { staff } = useRoot();
  const index = frontIndex(queue.selfies, focus);
  const current = queue.selfies[index];
  const rest = queue.selfies.filter((_, i) => i !== index);
  return (
    <>
      <QueueMotion>
        <QueueItem key={current.person.id} id={current.person.id}>
          <SelfieCompare
            item={{ ...current, cause: cause(current.cause) }}
            selfie={selfie?.user === current.person.id ? selfie.url : null}
            position={index + 1}
            total={queue.selfies.length}
            canDecide={can(staff, "moderator")}
          />
        </QueueItem>
      </QueueMotion>
      {rest.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Waiting after this one</h2>
          <ItemGroup className="gap-2">
            {rest.map((s) => (
              <Item key={s.person.id} variant="outline" size="sm" asChild>
                <Link to={`?case=${s.person.id}`} replace preventScrollReset>
                  <ItemMedia>
                    <PersonAvatar person={s.person} className="size-8" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{s.person.name || "No name yet"}</ItemTitle>
                    <ItemDescription>
                      Selfie sent <TimeAgo value={s.selfieAt} />
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </ItemActions>
                </Link>
              </Item>
            ))}
          </ItemGroup>
        </section>
      )}
    </>
  );
}

import { useNavigate, useSearchParams } from "react-router";
import { CameraIcon, ScanFaceIcon, ShieldBanIcon, UserRoundCheckIcon, UserRoundSearchIcon } from "lucide-react";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ActButton, HoldMenu, ReasonDialog } from "~/components/app/act";
import { MediaTile, Nothing, Page, PageHeader, PersonLink, TimeAgo } from "~/components/app/bits";
import { QueueItem, QueueMotion } from "~/components/app/motion";
import { useRoot } from "~/components/app/root-data";
import { staffContext } from "~/lib/context";
import { can } from "~/lib/roles";
import { query, signedUrl } from "~/lib/.server/db";
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

export async function loader({ context }: Route.LoaderArgs) {
  const staff = context.get(staffContext);
  const queue = await query<Queue>(staff, "admin_verifications");
  // Selfies are shown to moderators only, through 5-minute links; each viewing is logged.
  const selfies = can(staff, "moderator")
    ? await Promise.all(
        queue.selfies.map(async (s) => {
          const paths = await query<{ path: string; createdAt: string }[]>(staff, "admin_selfies", {
            p_user: s.person.id,
            p_reason: "verification queue",
          });
          return [s.person.id, await Promise.all(paths.slice(0, 1).map((p) => signedUrl("verification-selfies", p.path)))] as const;
        }),
      )
    : [];
  return { queue, selfies: Object.fromEntries(selfies) as Record<string, (string | null)[]> };
}

function cause(c: Cause | null) {
  if (!c) return "No reason recorded";
  return `${c.note ?? "No reason recorded"}${c.actor ? `, by ${c.actor}` : ", automatic"}`;
}

export default function Verifications({ loaderData: { queue, selfies } }: Route.ComponentProps) {
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

        <TabsContent value="selfies" className="mt-4">
          {queue.selfies.length === 0 ? (
            <Nothing title="No selfie to compare">When someone sends the selfie they owe, it lands here.</Nothing>
          ) : (
            <div className="grid gap-4">
              <QueueMotion>
                {queue.selfies.map((s) => (
                  <QueueItem key={s.person.id} id={s.person.id}>
                    <SelfieCase item={s} selfie={selfies[s.person.id]?.[0] ?? null} />
                  </QueueItem>
                ))}
              </QueueMotion>
            </div>
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
                        <HoldMenu user={r.person.id} name={r.person.name ?? ""} current="review" size="sm" />
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

function SelfieCase({ item: s, selfie }: { item: Queue["selfies"][number]; selfie: string | null }) {
  const { staff } = useRoot();
  const moderator = can(staff, "moderator");
  const name = s.person.name ?? "this account";
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <PersonLink person={s.person} showHold={false} />
        </CardTitle>
        <CardDescription>
          {cause(s.cause)}. Selfie sent <TimeAgo value={s.selfieAt} />.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Selfie</div>
            <AspectRatio ratio={3 / 4} className="overflow-hidden rounded-lg bg-muted ring-2 ring-primary/20">
              {moderator && selfie ? (
                <img src={selfie} alt={`Verification selfie of ${name}`} referrerPolicy="no-referrer" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
                  {moderator ? "The selfie file is missing." : "Selfies are shown to moderators."}
                </div>
              )}
            </AspectRatio>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Profile photos</div>
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-4">
              {s.photos.map((p) => (
                <MediaTile key={p.key} mediaKey={p.key}>
                  {p.status !== "approved" && (
                    <Badge variant="secondary" className="absolute top-2 left-2 capitalize">
                      {p.status}
                    </Badge>
                  )}
                </MediaTile>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
      {moderator && (
        <CardFooter className="flex flex-wrap justify-end gap-2 border-t">
          <ReasonDialog
            intent="hold"
            fields={{ user: s.person.id, state: "banned" }}
            destructive
            title={`Ban ${name}?`}
            description="The selfie isn't the person in the photos. Their email, phone and sign-ins can't come back."
            submit="Ban"
            trigger={
              <Button variant="destructive">
                <ShieldBanIcon data-icon="inline-start" />
                Not them: ban
              </Button>
            }
          />
          <ReasonDialog
            intent="hold"
            fields={{ user: s.person.id, state: "selfie" }}
            title="Ask for another selfie"
            description="Their account stays frozen until they send a new one."
            placeholder="Blurry, face hidden, not the front camera"
            submit="Ask again"
            trigger={
              <Button variant="outline">
                <CameraIcon data-icon="inline-start" />
                Ask again
              </Button>
            }
          />
          <ActButton intent="hold" fields={{ user: s.person.id, state: "", reason: "selfie matches the photos" }}>
            <UserRoundCheckIcon data-icon="inline-start" />
            Same person: lift the hold
          </ActButton>
        </CardFooter>
      )}
    </Card>
  );
}

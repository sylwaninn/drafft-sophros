import { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  CheckIcon,
  CopyIcon,
  EllipsisIcon,
  FingerprintIcon,
  LogOutIcon,
  MapPinIcon,
  MessagesSquareIcon,
  NotebookPenIcon,
  SmartphoneIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Field, FieldLabel } from "~/components/ui/field";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "~/components/ui/item";
import { Separator } from "~/components/ui/separator";
import { Spinner } from "~/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { ActButton, HoldControls, ReasonDialog, useAct } from "~/components/app/act";
import {
  Facts,
  HoldBadge,
  Id,
  MediaTile,
  Nothing,
  OverlayBadge,
  Page,
  Panel,
  PersonAvatar,
  PersonLink,
  TimeAgo,
} from "~/components/app/bits";
import { ConversationDrawer } from "~/components/app/conversation-drawer";
import { age } from "~/components/app/format";
import { useMediaUrl, useRoot } from "~/components/app/root-data";
import { staffContext } from "~/lib/context";
import { can } from "~/lib/roles";
import { query } from "~/lib/.server/db";
import { revalidateOnNewRead } from "~/lib/audited-reads";
import type { AuditEntry, UserDetail } from "~/lib/types";
import { reasons } from "./reports";
import type { Route } from "./+types/account";

export async function loader({ params, context }: Route.LoaderArgs) {
  const staff = context.get(staffContext);
  const [user, audit] = await Promise.all([
    query<UserDetail>(staff, "admin_user", { p_user: params.id }),
    can(staff, "moderator") ? query<AuditEntry[]>(staff, "admin_audit", { p_user: params.id, p_limit: 50 }) : Promise.resolve(null),
  ]);
  return { user, audit };
}

// Another tab shows the same account: it isn't read (nor logged as opened) again.
export const shouldRevalidate = revalidateOnNewRead(() => "");

export const handle = { crumb: (data: unknown) => (data as { user?: UserDetail } | undefined)?.user?.profile.name || "Account" };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.user.profile.name || "Account"} | sophros` }];
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <Panel title={title} action={count !== undefined ? <Badge variant="secondary">{count}</Badge> : undefined}>
      {children}
    </Panel>
  );
}

export default function Account({ loaderData: { user: u, audit } }: Route.ComponentProps) {
  const { staff } = useRoot();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const p = u.profile;
  const photo = u.media.find((m) => m.status === "approved") ?? u.media[0];
  const moderator = can(staff, "moderator");
  const tab = params.get("tab") ?? "profile";
  const safetyOpen = u.reportsReceived.filter((r) => !r.handledAt).length + u.flags.filter((f) => !f.reviewed_at).length;
  const years = age(p.birthdate);
  const premium = typeof u.wallet?.premium_until === "string" && new Date(u.wallet.premium_until) > new Date();

  return (
    <Page>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <PersonAvatar person={{ name: p.name, photo: photo ? (photo.posterKey ?? photo.key) : null }} className="size-16" />
          <div className="min-w-0 space-y-1.5">
            <h1 className="flex flex-wrap items-baseline gap-2 text-2xl font-semibold tracking-tight">
              {p.name || <span className="text-muted-foreground">No name yet</span>}
              {years !== null && <span className="text-xl font-normal text-muted-foreground">{years}</span>}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <HoldBadge hold={p.moderation} />
              {p.paused && !p.moderation && <Badge variant="secondary">Paused</Badge>}
              {!p.onboarded_at && <Badge variant="outline">Onboarding</Badge>}
              {premium && <Badge variant="outline">tempo</Badge>}
              <Id value={p.id} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {moderator && u.matches.length > 0 && (
            <Button variant="outline" asChild>
              <Link to={`/conversations?user=${p.id}`} viewTransition>
                <MessagesSquareIcon data-icon="inline-start" />
                Conversations
                <Badge variant="secondary">{u.matches.length}</Badge>
              </Link>
            </Button>
          )}
          <HoldControls user={p.id} name={p.name} current={p.moderation} />
          <MoreMenu u={u} moderator={moderator} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Tabs
          value={tab}
          onValueChange={(t) => navigate(t === "profile" ? "?" : `?tab=${t}`, { replace: true, preventScrollReset: true })}
          className="min-w-0"
        >
          <TabsList className="flex-wrap">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="safety">
              Safety
              {safetyOpen > 0 && <Badge variant="destructive">{safetyOpen}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="matches">
              Conversations
              <Badge variant="secondary">{u.matches.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="billing">Billing and support</TabsTrigger>
            <TabsTrigger value="notes">
              Notes
              {u.notes.length > 0 && <Badge variant="secondary">{u.notes.length}</Badge>}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="mt-4 space-y-6">
            <ProfileTab u={u} moderator={moderator} />
          </TabsContent>
          <TabsContent value="activity" className="mt-4 space-y-6">
            <ActivityTab u={u} />
          </TabsContent>
          <TabsContent value="safety" className="mt-4 space-y-6">
            <SafetyTab u={u} />
          </TabsContent>
          <TabsContent value="matches" className="mt-4">
            <MatchesTab u={u} moderator={moderator} />
          </TabsContent>
          <TabsContent value="billing" className="mt-4 space-y-6">
            <BillingTab u={u} />
          </TabsContent>
          <TabsContent value="notes" className="mt-4 space-y-6">
            <NotesTab u={u} audit={audit} />
          </TabsContent>
        </Tabs>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Panel title="Identity">
            <Facts
              rows={[
                [
                  "Email",
                  <span key="e" className="break-all">
                    {u.auth.email}
                    {u.auth.email && !u.auth.emailConfirmedAt && (
                      <Badge variant="outline" className="ml-1">
                        unconfirmed
                      </Badge>
                    )}
                  </span>,
                ],
                ["Phone", u.auth.phone ? `+${u.auth.phone}` : null],
                ["Sign-in", u.auth.providers.map((i) => i.provider).join(", ") || null],
                ["Signed up", <TimeAgo key="c" value={u.auth.createdAt} />],
                ["Last sign-in", <TimeAgo key="s" value={u.auth.lastSignInAt} />],
                ["Last active", <TimeAgo key="a" value={p.last_active_at} />],
                ["Last opened", <TimeAgo key="o" value={u.devices[0]?.last_seen_at} />],
                [
                  "Language",
                  <span key="l" className="uppercase">
                    {p.language}
                  </span>,
                ],
              ]}
            />
          </Panel>
          {u.related.length > 0 && (
            <Panel title="Looks related" description="Same iPhone install, IP or identity">
              <ItemGroup className="gap-1">
                {u.related.map((r, i) => (
                  <Item key={i} size="sm" className="px-0">
                    <ItemContent>
                      <ItemTitle>
                        <PersonLink person={r.person} />
                      </ItemTitle>
                      <ItemDescription>
                        {r.via === "install" ? "Same iPhone install" : r.via === "ip" ? `Same IP ${r.detail}` : `Same ${r.detail}`}
                        {r.at && (
                          <>
                            , <TimeAgo value={r.at} />
                          </>
                        )}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            </Panel>
          )}
        </aside>
      </div>
    </Page>
  );
}

function MoreMenu({ u, moderator }: { u: UserDetail; moderator: boolean }) {
  const [revoking, setRevoking] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More actions">
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onSelect={() => {
              void navigator.clipboard.writeText(u.profile.id);
              toast.success("Account id copied");
            }}
          >
            <CopyIcon />
            Copy account id
          </DropdownMenuItem>
          {moderator && (
            <>
              <DropdownMenuItem asChild>
                <Link to={`/conversations?user=${u.profile.id}`} viewTransition>
                  <MessagesSquareIcon />
                  Their conversations
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setRevoking(true)}>
                <LogOutIcon />
                Sign out everywhere
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {moderator && (
        <ReasonDialog
          intent="revoke-sessions"
          fields={{ user: u.profile.id }}
          title="Sign out everywhere"
          description={`Ends ${u.sessions.length} open session${u.sessions.length === 1 ? "" : "s"}. The app asks them to sign in again within the hour.`}
          submit="Sign out everywhere"
          open={revoking}
          onOpenChange={setRevoking}
        />
      )}
    </>
  );
}

// MARK: Tabs

function ProfileTab({ u, moderator }: { u: UserDetail; moderator: boolean }) {
  const p = u.profile;
  const media = useMediaUrl();
  const text = (key: string) => (typeof p[key] === "string" && p[key] ? (p[key] as string) : null);
  const off = Object.entries(p)
    .filter(([k, v]) => k.startsWith("notify_") && v === false)
    .map(([k]) => k.replace("notify_", "").replaceAll("_", " "));
  return (
    <>
      <Section title="Photos" count={u.media.length}>
        {u.media.length === 0 ? (
          <Nothing title="No photo" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {u.media.map((m) => (
              <div key={m.id} className="space-y-2">
                <MediaTile
                  mediaKey={m.key}
                  kind={m.kind}
                  posterKey={m.posterKey}
                  gallery={u.media.map((x, i) => ({
                    key: x.key,
                    kind: x.kind,
                    posterKey: x.posterKey,
                    caption: `Photo ${i + 1} of ${u.media.length}, ${x.status}`,
                  }))}
                  index={u.media.indexOf(m)}
                  title={`${p.name || "Their"} photos`}
                >
                  <OverlayBadge tone={m.status === "rejected" ? "danger" : "neutral"}>
                    {m.reviewRequestedAt ? `${m.status}, second look` : m.status}
                  </OverlayBadge>
                </MediaTile>
                {moderator && (
                  <div className="flex gap-1.5">
                    {m.status !== "approved" && (
                      <ActButton intent="media" fields={{ media: m.id, approved: "true" }} size="xs" variant="outline" className="flex-1">
                        <CheckIcon data-icon="inline-start" />
                        Approve
                      </ActButton>
                    )}
                    {m.status !== "rejected" && (
                      <ActButton intent="media" fields={{ media: m.id, approved: "false" }} size="xs" variant="outline" className="flex-1">
                        <XIcon data-icon="inline-start" />
                        Refuse
                      </ActButton>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="About">
          <div className="space-y-4 text-sm">
            {text("bio") ? <p className="whitespace-pre-wrap">{text("bio")}</p> : <p className="text-muted-foreground">No bio.</p>}
            {u.sports.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {u.sports.map((s) => (
                  <Badge key={s.sport} variant="outline">
                    {s.sport}, {s.perWeek}× a week
                  </Badge>
                ))}
              </div>
            )}
            {u.prompts.map((q, i) => (
              <div key={i}>
                <div className="text-xs text-muted-foreground">{q.question}</div>
                <div>{q.answer}</div>
              </div>
            ))}
            {p.voice_intro_key && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Voice intro</div>
                <audio controls preload="none" src={media(p.voice_intro_key)} className="h-9 w-full" />
              </div>
            )}
          </div>
        </Section>
        <Section title="Details">
          <Facts
            rows={[
              ["Birthdate", p.birthdate],
              ["Gender", p.gender],
              ["Interested in", (p.interested_in as string[] | undefined)?.join(", ") || "Everyone"],
              ["Pronouns", text("pronouns")],
              ["Neighbourhood", text("neighborhood")],
              ["Favourite spot", text("favorite_spot")],
              ["Goal", text("goal")],
              ["Drinks, smokes", [text("drinks"), text("smokes")].filter(Boolean).join(", ") || null],
              ["Diet, rhythm", [text("diet"), text("chronotype")].filter(Boolean).join(", ") || null],
              ["Notifications off", off.join(", ") || null],
            ]}
          />
        </Section>
      </div>
    </>
  );
}

function ActivityTab({ u }: { u: UserDetail }) {
  return (
    <>
      <Section title="Devices" count={u.devices.length}>
        {u.devices.length === 0 ? (
          <Nothing icon={<SmartphoneIcon />} title="No device reported">
            App versions before device reports send nothing.
          </Nothing>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>iPhone</TableHead>
                <TableHead>iOS</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Locale</TableHead>
                <TableHead>Last IP</TableHead>
                <TableHead className="text-right">Opens</TableHead>
                <TableHead className="text-right">Last opened</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {u.devices.map((d) => (
                <TableRow key={d.install_id}>
                  <TableCell className="font-medium" title={d.install_id}>
                    {d.model || "Unknown"}
                  </TableCell>
                  <TableCell>{d.os_version}</TableCell>
                  <TableCell>
                    {d.app_version} <span className="text-muted-foreground">({d.app_build})</span>
                  </TableCell>
                  <TableCell>
                    {d.locale} <span className="text-muted-foreground">{d.timezone}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{d.ip}</span> {d.country && <Badge variant="outline">{d.country}</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{d.opens}</TableCell>
                  <TableCell className="text-right">
                    <TimeAgo value={d.last_seen_at} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Location">
          {u.location ? (
            <Facts
              rows={[
                [
                  "Area",
                  <Button key="map" variant="link" className="h-auto p-0" asChild>
                    <a
                      target="_blank"
                      rel="noreferrer noopener"
                      href={`https://www.openstreetmap.org/?mlat=${u.location.lat}&mlon=${u.location.lng}#map=13/${u.location.lat}/${u.location.lng}`}
                    >
                      <MapPinIcon data-icon="inline-start" />
                      {u.location.lat.toFixed(3)}, {u.location.lng.toFixed(3)}
                    </a>
                  </Button>,
                ],
                ["Precision", "About 1 km"],
                ["Updated", <TimeAgo key="u" value={u.location.updatedAt} />],
              ]}
            />
          ) : (
            <Nothing icon={<MapPinIcon />} title="No location" />
          )}
        </Section>
        <Section title="Behaviour">
          <Facts
            rows={[
              ["Likes given", `${u.stats.likesGiven}, ${u.stats.likesGiven24h} in 24 h`],
              ["Passes", String(u.stats.passes)],
              ["Likes received", String(u.stats.likesReceived)],
              ["Matches", String(u.stats.matches)],
              ["Sessions", String(u.stats.sessions)],
              ["Push", u.pushTokens.map((t) => t.environment).join(", ") || null],
              [
                "DeviceCheck",
                u.deviceCheck ? (
                  <span key="dc" className="inline-flex items-center gap-1.5">
                    {u.deviceCheck.environment}
                    {u.deviceCheck.flaggedAt && <Badge variant="destructive">Flagged device</Badge>}
                  </span>
                ) : null,
              ],
            ]}
          />
        </Section>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="IP addresses" count={u.ips.length}>
          {u.ips.length === 0 ? (
            <Nothing title="None yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {u.ips.map((i) => (
                  <TableRow key={i.ip}>
                    <TableCell className="font-mono text-xs">{i.ip}</TableCell>
                    <TableCell>{i.country}</TableCell>
                    <TableCell className="text-right">
                      <TimeAgo value={i.last_seen_at} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
        <Section title="Signed-in sessions" count={u.sessions.length}>
          {u.sessions.length === 0 ? (
            <Nothing title="No open session" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead className="text-right">Refreshed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {u.sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="max-w-44 truncate text-xs" title={s.userAgent ?? ""}>
                      {s.userAgent}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.ip}</TableCell>
                    <TableCell className="text-right">
                      <TimeAgo value={s.refreshedAt ? `${s.refreshedAt}Z` : s.createdAt} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      </div>
    </>
  );
}

function SafetyTab({ u }: { u: UserDetail }) {
  return (
    <>
      <Section title="Hold history" count={u.moderationLog.length}>
        {u.moderationLog.length === 0 ? (
          <Nothing title="Never held" />
        ) : (
          <ItemGroup className="gap-1">
            {u.moderationLog.map((l, i) => (
              <Item key={i} size="sm" className="px-0">
                <ItemMedia>{l.state ? <HoldBadge hold={l.state} /> : <Badge variant="outline">Lifted</Badge>}</ItemMedia>
                <ItemContent>
                  <ItemTitle className="font-normal">{l.note ?? "No reason recorded"}</ItemTitle>
                  <ItemDescription>
                    {l.actor ?? "Automatic"}, <TimeAgo value={l.createdAt} />
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        )}
        {(u.marks.length > 0 || u.selfies.length > 0) && (
          <>
            <Separator className="my-4" />
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {u.marks.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <FingerprintIcon className="size-4" />
                  {u.marks.length} identities marked
                </span>
              )}
              {u.selfies.length > 0 && (
                <Link to="/verifications" viewTransition className="underline-offset-4 hover:underline">
                  Selfie sent <TimeAgo value={u.selfies[0].createdAt} />
                </Link>
              )}
            </div>
          </>
        )}
      </Section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Reported" count={u.reportsReceived.length}>
          {u.reportsReceived.length === 0 ? (
            <Nothing title="Never reported" />
          ) : (
            <ItemGroup className="gap-1">
              {u.reportsReceived.map((r) => (
                <Item key={r.id} size="sm" className="px-0">
                  <ItemContent>
                    <ItemTitle>
                      <Badge variant={r.handledAt ? "outline" : "destructive"}>{reasons[r.reason] ?? r.reason}</Badge>
                      <span className="font-normal text-muted-foreground">by</span>
                      <PersonLink person={r.reporter} showHold={false} />
                    </ItemTitle>
                    <ItemDescription>
                      {r.details || "No details"}, <TimeAgo value={r.createdAt} />
                      {r.handledAt && `. Closed by ${r.handledBy}: ${r.resolution}`}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          )}
        </Section>
        <Section title="Reported others" count={u.reportsMade.length}>
          {u.reportsMade.length === 0 ? (
            <Nothing title="Never reported anyone" />
          ) : (
            <ItemGroup className="gap-1">
              {u.reportsMade.map((r) => (
                <Item key={r.id} size="sm" className="px-0">
                  <ItemContent>
                    <ItemTitle>
                      <Badge variant="secondary">{reasons[r.reason] ?? r.reason}</Badge>
                      <PersonLink person={r.reported} />
                    </ItemTitle>
                    <ItemDescription>
                      <TimeAgo value={r.createdAt} />
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          )}
        </Section>
        <Section title="Blocked by" count={u.blocksReceived.length}>
          <People items={u.blocksReceived} empty="Nobody blocked this account" />
        </Section>
        <Section title="Blocked" count={u.blocksGiven.length}>
          <People items={u.blocksGiven} empty="Blocked nobody" />
        </Section>
      </div>
      <Section title="Flagged media" count={u.flags.length}>
        {u.flags.length === 0 ? (
          <Nothing title="Nothing flagged" />
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
            {u.flags.map((f) => (
              <div key={f.id} className="space-y-1.5">
                <MediaTile
                  mediaKey={f.key}
                  gallery={u.flags.map((x) => ({ key: x.key, caption: `${x.context}: ${x.labels.join(", ")}` }))}
                  index={u.flags.indexOf(f)}
                  title="Flagged media"
                >
                  <OverlayBadge tone={f.verdict === "rejected" ? "danger" : "neutral"}>{f.context}</OverlayBadge>
                </MediaTile>
                <p className="truncate text-xs text-muted-foreground" title={f.labels.join(", ")}>
                  {f.labels[0]}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function People({ items, empty }: { items: UserDetail["blocksGiven"]; empty: string }) {
  if (items.length === 0) return <Nothing title={empty} />;
  return (
    <ItemGroup className="gap-1">
      {items.map((b, i) => (
        <Item key={i} size="sm" className="px-0">
          <ItemContent>
            <ItemTitle>
              <PersonLink person={b.person} />
            </ItemTitle>
          </ItemContent>
          <ItemDescription>
            <TimeAgo value={b.createdAt} />
          </ItemDescription>
        </Item>
      ))}
    </ItemGroup>
  );
}

function MatchesTab({ u, moderator }: { u: UserDetail; moderator: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  if (u.matches.length === 0) return <Nothing icon={<MessagesSquareIcon />} title="No match yet" />;
  return (
    <Card className="py-0">
      <ConversationDrawer matchId={open} from={`account ${u.profile.name || u.profile.id}`} onClose={() => setOpen(null)} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">With</TableHead>
            <TableHead>Matched</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pr-4 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {u.matches.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="pl-4">
                <PersonLink person={m.other} />
              </TableCell>
              <TableCell>
                <TimeAgo value={m.createdAt} />
              </TableCell>
              <TableCell>{m.endedAt ? <Badge variant="outline">Ended</Badge> : <Badge variant="secondary">Active</Badge>}</TableCell>
              <TableCell className="pr-4 text-right">
                {moderator && (
                  <Button variant="ghost" size="sm" onClick={() => setOpen(m.id)}>
                    <MessagesSquareIcon data-icon="inline-start" />
                    Read
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function BillingTab({ u }: { u: UserDetail }) {
  const w = u.wallet ?? {};
  return (
    <>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Wallet">
          <Facts
            rows={[
              ["tempo until", typeof w.premium_until === "string" ? <TimeAgo key="p" value={w.premium_until} exact /> : null],
              ["Super likes", String(w.super_likes ?? 0)],
              ["Boosts", String(w.boosts ?? 0)],
              ["Boost ends", typeof w.boost_ends_at === "string" ? <TimeAgo key="b" value={w.boost_ends_at} /> : null],
            ]}
          />
        </Section>
        <Section title="Support" count={u.support.length + u.dataRequests.length}>
          {u.support.length + u.dataRequests.length === 0 ? (
            <Nothing title="Never wrote in" />
          ) : (
            <ItemGroup className="gap-1">
              {u.support.map((s) => (
                <Item key={s.id} size="sm" className="px-0" asChild>
                  <Link to={`/support?q=${s.reference}&status=all`} viewTransition>
                    <ItemContent>
                      <ItemTitle>
                        <span className="font-mono text-xs">{s.reference}</span> {s.topic}
                      </ItemTitle>
                      <ItemDescription>
                        <TimeAgo value={s.createdAt} />
                      </ItemDescription>
                    </ItemContent>
                    {s.handledAt ? <Badge variant="outline">Handled</Badge> : <Badge>Open</Badge>}
                  </Link>
                </Item>
              ))}
              {u.dataRequests.map((d) => (
                <Item key={`d${d.id}`} size="sm" className="px-0">
                  <ItemContent>
                    <ItemTitle>Data export</ItemTitle>
                    <ItemDescription>
                      Asked <TimeAgo value={d.created_at} />
                    </ItemDescription>
                  </ItemContent>
                  {d.fulfilled_at ? <Badge variant="outline">Sent</Badge> : <Badge>To send</Badge>}
                </Item>
              ))}
            </ItemGroup>
          )}
        </Section>
      </div>
      <Section title="Purchases" count={u.purchases.length}>
        {u.purchases.length === 0 ? (
          <Nothing title="No purchase" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Effect</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {u.purchases.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <TimeAgo value={e.event_at} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {e.type} {e.environment === "SANDBOX" && <Badge variant="outline">sandbox</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.product_id?.replace("so.drafft.app.", "")}</TableCell>
                  <TableCell className="text-right text-xs">{e.effect}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </>
  );
}

function NotesTab({ u, audit }: { u: UserDetail; audit: AuditEntry[] | null }) {
  const form = useRef<HTMLFormElement>(null);
  const { fetcher, pending } = useAct({ onDone: () => form.current?.reset() });
  return (
    <>
      <Panel title="Notes for the team">
        <fetcher.Form ref={form} method="post" action="/act" className="space-y-3">
          <input type="hidden" name="intent" value="note" />
          <input type="hidden" name="user" value={u.profile.id} />
          <Field>
            <FieldLabel htmlFor="note-body" className="sr-only">
              Note
            </FieldLabel>
            <Textarea
              id="note-body"
              name="body"
              required
              rows={3}
              maxLength={2000}
              placeholder="What the next person to open this account should know"
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : <NotebookPenIcon data-icon="inline-start" />}
              Add note
            </Button>
          </div>
        </fetcher.Form>
        {u.notes.length > 0 && (
          <ItemGroup className="mt-4 gap-2">
            {u.notes.map((n) => (
              <Item key={n.id} variant="muted">
                <ItemContent>
                  <ItemTitle className="font-normal whitespace-pre-wrap">{n.body}</ItemTitle>
                  <ItemDescription>
                    {n.author}, <TimeAgo value={n.created_at} />
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        )}
      </Panel>
      {audit && (
        <Section title="Staff trail" count={audit.length}>
          {audit.length === 0 ? (
            <Nothing title="Nobody opened this account yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>Why</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <TimeAgo value={a.created_at} />
                    </TableCell>
                    <TableCell>{a.actor}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {a.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground" title={a.reason ?? ""}>
                      {a.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      )}
    </>
  );
}

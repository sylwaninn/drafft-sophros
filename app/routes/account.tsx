import { isRouteErrorResponse, Link } from "react-router";
import { staffContext } from "~/lib/context";
import { can } from "~/lib/roles";
import { query } from "~/lib/.server/db";
import type { AuditEntry, UserDetail } from "~/lib/types";
import { ActForm, Button, HoldForm, NoteForm, ReasonAction } from "~/components/actions";
import { Avatar, Badge, Card, Empty, Facts, HoldBadge, MediaTile, Mono, Page, PersonLink, Table, Time, useMediaUrl, useRoot } from "~/components/ui";
import type { Route } from "./+types/account";

export async function loader({ params, context }: Route.LoaderArgs) {
  const staff = context.get(staffContext);
  const [user, audit] = await Promise.all([
    query<UserDetail>(staff, "admin_user", { p_user: params.id }),
    can(staff, "moderator") ? query<AuditEntry[]>(staff, "admin_audit", { p_user: params.id, p_limit: 50 }) : Promise.resolve(null),
  ]);
  return { user, audit };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.user.profile.name || "Account"} | sophros` }];
}

function age(birthdate: string | null) {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  const now = new Date();
  return now.getFullYear() - b.getFullYear() - (now < new Date(now.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
}

const sections = [
  ["profile", "Profile"],
  ["activity", "Activity and devices"],
  ["safety", "Safety"],
  ["matches", "Matches"],
  ["money", "Purchases and support"],
  ["notes", "Notes and trail"],
] as const;

export default function Account({ loaderData: { user: u, audit } }: Route.ComponentProps) {
  const { staff } = useRoot();
  const p = u.profile;
  const photo = u.media.find((m) => m.status === "approved") ?? u.media[0];
  const lastOpened = u.devices[0]?.last_seen_at ?? null;
  const moderator = can(staff, "moderator");

  return (
    <Page
      title={
        <span className="flex items-center gap-3">
          <Avatar photo={photo ? (photo.posterKey ?? photo.key) : null} name={p.name} size={44} />
          <span>
            {p.name || <span className="text-mute">no name yet</span>}
            {age(p.birthdate) !== null && <span className="ml-2 font-normal text-mute">{age(p.birthdate)}</span>}
          </span>
          <HoldBadge hold={p.moderation} />
          {p.paused && !p.moderation && <Badge>Paused</Badge>}
          {!p.onboarded_at && <Badge>Onboarding</Badge>}
        </span>
      }
      subtitle={<Mono>{p.id}</Mono>}
    >
      <nav className="sticky top-0 z-10 -mx-6 mb-4 flex gap-4 overflow-x-auto border-b border-line bg-soft/95 px-6 py-2 text-sm backdrop-blur">
        {sections.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="whitespace-nowrap text-body hover:text-ink">
            {label}
          </a>
        ))}
      </nav>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          <Card>
            <Facts
              rows={[
                ["Email", <>{u.auth.email} {u.auth.email && !u.auth.emailConfirmedAt && <Badge tone="warning">unconfirmed</Badge>}</>],
                ["Phone", u.auth.phone ? <>+{u.auth.phone} {!u.auth.phoneConfirmedAt && <Badge tone="warning">unconfirmed</Badge>}</> : null],
                ["Sign-in", u.auth.providers.map((i) => i.provider).join(", ") || null],
                ["Signed up", <Time key="c" value={u.auth.createdAt} exact />],
                ["Last sign-in", <Time key="s" value={u.auth.lastSignInAt} />],
                ["Last active", <Time key="a" value={p.last_active_at} />],
                ["Last opened", <Time key="o" value={lastOpened} />],
                ["Language", p.language ?? null],
              ]}
            />
          </Card>

          <Profile u={u} moderator={moderator} />
          <Activity u={u} />
          <Safety u={u} />
          <Matches u={u} moderator={moderator} />
          <Money u={u} />

          <Card id="notes" title="Notes">
            <NoteForm user={p.id} />
            <ul className="mt-4 space-y-3">
              {u.notes.map((n) => (
                <li key={n.id} className="text-sm">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-0.5 text-xs text-mute">
                    {n.author}, <Time value={n.created_at} />
                  </p>
                </li>
              ))}
            </ul>
          </Card>
          {audit && (
            <Card title="Staff trail" aside="Everything the team did or opened on this account">
              {audit.length === 0 ? (
                <Empty>Nothing yet.</Empty>
              ) : (
                <Table head={["When", "Who", "What", "Why"]}>
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Time value={a.created_at} />
                      </td>
                      <td className="text-body">{a.actor}</td>
                      <td>
                        <Mono>{a.action}</Mono>
                      </td>
                      <td className="text-body">{a.reason}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-12 lg:self-start">
          <Card title="Hold">
            <HoldForm user={p.id} current={p.moderation} />
          </Card>
          {moderator && (
            <Card title="Sessions">
              <p className="mb-2 text-xs text-mute">Signs the account out on every device ({u.sessions.length} open).</p>
              <ReasonAction intent="revoke-sessions" fields={{ user: p.id }} label="Sign out everywhere" tone="quiet" />
            </Card>
          )}
          {u.related.length > 0 && (
            <Card title="Looks related" aside="same install, IP or identity">
              <ul className="space-y-2">
                {u.related.map((r, i) => (
                  <li key={i} className="text-sm">
                    <PersonLink person={r.person} size={22} />
                    <div className="ml-8 text-xs text-mute">
                      {r.via === "install" ? "same iPhone install" : r.via === "ip" ? `same IP ${r.detail}` : `same ${r.detail}`}
                      {r.at && (
                        <>
                          , <Time value={r.at} />
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </Page>
  );
}

function Profile({ u, moderator }: { u: UserDetail; moderator: boolean }) {
  const p = u.profile;
  const media = useMediaUrl();
  const text = (key: string) => (typeof p[key] === "string" && p[key] ? (p[key] as string) : null);
  const settings = Object.entries(p).filter(([k]) => k.startsWith("notify_"));
  return (
    <Card id="profile" title="Profile">
      {u.media.length === 0 ? (
        <Empty>No photo.</Empty>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {u.media.map((m) => (
            <figure key={m.id} className="space-y-1">
              <MediaTile mediaKey={m.key} kind={m.kind} posterKey={m.posterKey} />
              <figcaption className="flex flex-wrap items-center gap-1">
                <Badge tone={m.status === "approved" ? "lime" : m.status === "rejected" ? "negative" : "warning"}>{m.status}</Badge>
                {m.reviewRequestedAt && <Badge tone="cyan">second look</Badge>}
              </figcaption>
              {moderator && (
                <div className="flex gap-1">
                  {m.status !== "approved" && (
                    <ActForm intent="media" fields={{ media: m.id, approved: "true" }}>
                      {({ pending }) => (
                        <Button pending={pending} className="px-2 py-0.5 text-xs">
                          Approve
                        </Button>
                      )}
                    </ActForm>
                  )}
                  {m.status !== "rejected" && (
                    <ActForm intent="media" fields={{ media: m.id, approved: "false" }} confirm="Refuse this photo? It leaves the profile.">
                      {({ pending }) => (
                        <Button pending={pending} className="px-2 py-0.5 text-xs">
                          Refuse
                        </Button>
                      )}
                    </ActForm>
                  )}
                </div>
              )}
            </figure>
          ))}
        </div>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Facts
          rows={[
            ["Birthdate", p.birthdate],
            ["Gender", p.gender],
            ["Interested in", (p.interested_in as string[] | undefined)?.join(", ") || "everyone"],
            ["Pronouns", text("pronouns")],
            ["Neighbourhood", text("neighborhood")],
            ["Favourite spot", text("favorite_spot")],
            ["Goal", text("goal")],
            ["Drinks, smokes", [text("drinks"), text("smokes")].filter(Boolean).join(", ") || null],
            ["Diet, rhythm", [text("diet"), text("chronotype")].filter(Boolean).join(", ") || null],
          ]}
        />
        <div className="space-y-3 text-sm">
          {text("bio") && <p className="whitespace-pre-wrap">{text("bio")}</p>}
          {u.sports.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {u.sports.map((s) => (
                <Badge key={s.sport}>
                  {s.sport} {s.perWeek}×/wk
                </Badge>
              ))}
            </div>
          )}
          {u.prompts.map((q, i) => (
            <div key={i}>
              <div className="text-xs text-mute">{q.question}</div>
              <div>{q.answer}</div>
            </div>
          ))}
          {p.icebreaker != null && (
            <div>
              <div className="text-xs text-mute">Icebreaker</div>
              <Mono>{JSON.stringify(p.icebreaker)}</Mono>
            </div>
          )}
          {p.voice_intro_key && (
            <div>
              <div className="text-xs text-mute">Voice intro</div>
              <audio controls preload="none" src={media(p.voice_intro_key) ?? undefined} className="mt-1 h-8 w-full" />
              {text("voice_transcript") && <p className="mt-1 text-body italic">{text("voice_transcript")}</p>}
            </div>
          )}
        </div>
      </div>
      {settings.length > 0 && (
        <p className="mt-4 text-xs text-mute">
          Notifications off: {settings.filter(([, v]) => v === false).map(([k]) => k.replace("notify_", "").replaceAll("_", " ")).join(", ") || "none"}
        </p>
      )}
    </Card>
  );
}

function Activity({ u }: { u: UserDetail }) {
  return (
    <div id="activity" className="scroll-mt-12 space-y-4">
      <Card title="Devices" aside="reported by the app each time it comes to the front">
        {u.devices.length === 0 ? (
          <Empty>No device reported yet (app versions before device reports, or never opened).</Empty>
        ) : (
          <Table head={["iPhone", "iOS", "App", "Locale, time zone", "Last IP", "Opens", "First seen", "Last opened"]}>
            {u.devices.map((d) => (
              <tr key={d.install_id}>
                <td title={d.install_id}>{d.model || "?"}</td>
                <td>{d.os_version}</td>
                <td>
                  {d.app_version} ({d.app_build})
                </td>
                <td className="text-body">
                  {d.locale}, {d.timezone}
                </td>
                <td>
                  {d.ip && <Mono>{d.ip}</Mono>} {d.country}
                </td>
                <td>{d.opens}</td>
                <td>
                  <Time value={d.first_seen_at} />
                </td>
                <td>
                  <Time value={d.last_seen_at} />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Location" aside="snapped to about 1 km">
          {u.location ? (
            <Facts
              rows={[
                [
                  "Area",
                  <a
                    key="map"
                    className="underline"
                    target="_blank"
                    rel="noreferrer noopener"
                    href={`https://www.openstreetmap.org/?mlat=${u.location.lat}&mlon=${u.location.lng}#map=13/${u.location.lat}/${u.location.lng}`}
                  >
                    {u.location.lat.toFixed(3)}, {u.location.lng.toFixed(3)}
                  </a>,
                ],
                ["Updated", <Time key="u" value={u.location.updatedAt} />],
                ["Neighbourhood", (u.profile.neighborhood as string) || null],
              ]}
            />
          ) : (
            <Empty>No location.</Empty>
          )}
        </Card>
        <Card title="Usage">
          <Facts
            rows={[
              ["Likes given", `${u.stats.likesGiven} (${u.stats.likesGiven24h} in 24 h)`],
              ["Passes", u.stats.passes],
              ["Likes received", u.stats.likesReceived],
              ["Matches", u.stats.matches],
              ["Sessions", u.stats.sessions],
              ["Push", u.pushTokens.map((t) => t.environment).join(", ") || null],
              [
                "DeviceCheck",
                u.deviceCheck ? (
                  <>
                    {u.deviceCheck.environment}, <Time value={u.deviceCheck.updatedAt} />
                    {u.deviceCheck.flaggedAt && (
                      <>
                        {" "}
                        <Badge tone="warning">flagged device</Badge>
                      </>
                    )}
                  </>
                ) : null,
              ],
            ]}
          />
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="IP addresses" aside="180 days">
          {u.ips.length === 0 ? (
            <Empty>None yet.</Empty>
          ) : (
            <Table head={["IP", "Country", "First", "Last"]}>
              {u.ips.map((i) => (
                <tr key={i.ip}>
                  <td>
                    <Mono>{i.ip}</Mono>
                  </td>
                  <td>{i.country}</td>
                  <td>
                    <Time value={i.first_seen_at} />
                  </td>
                  <td>
                    <Time value={i.last_seen_at} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Signed-in sessions" aside="Supabase Auth">
          {u.sessions.length === 0 ? (
            <Empty>None open.</Empty>
          ) : (
            <Table head={["Client", "IP", "Started", "Refreshed"]}>
              {u.sessions.map((s) => (
                <tr key={s.id}>
                  <td className="max-w-48 truncate text-xs text-body" title={s.userAgent ?? ""}>
                    {s.userAgent}
                  </td>
                  <td>{s.ip && <Mono>{s.ip}</Mono>}</td>
                  <td>
                    <Time value={s.createdAt} />
                  </td>
                  <td>
                    <Time value={s.refreshedAt ? `${s.refreshedAt}Z` : null} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}

function Safety({ u }: { u: UserDetail }) {
  return (
    <div id="safety" className="scroll-mt-12 space-y-4">
      <Card title="Holds" aside={u.marks.length ? `${u.marks.length} identities marked` : undefined}>
        {u.moderationLog.length === 0 ? (
          <Empty>Never held.</Empty>
        ) : (
          <Table head={["When", "Became", "Why", "By"]}>
            {u.moderationLog.map((l, i) => (
              <tr key={i}>
                <td>
                  <Time value={l.createdAt} />
                </td>
                <td>{l.state ? <HoldBadge hold={l.state} /> : <Badge tone="lime">Lifted</Badge>}</td>
                <td className="text-body">{l.note}</td>
                <td className="text-xs text-mute">{l.actor ?? "automatic"}</td>
              </tr>
            ))}
          </Table>
        )}
        {u.selfies.length > 0 && (
          <p className="mt-3 text-sm">
            {u.selfies.length} selfie{u.selfies.length > 1 ? "s" : ""} sent, last <Time value={u.selfies[0].createdAt} />.{" "}
            <Link to="/verifications" className="underline">
              Compare them
            </Link>
          </p>
        )}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={`Reported ${u.reportsReceived.length} times`}>
          {u.reportsReceived.length === 0 ? (
            <Empty>Never reported.</Empty>
          ) : (
            <ul className="space-y-3 text-sm">
              {u.reportsReceived.map((r) => (
                <li key={r.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="negative">{r.reason}</Badge>
                    <span className="text-mute">by</span>
                    <PersonLink person={r.reporter} size={20} showHold={false} />
                    <Time value={r.createdAt} />
                  </div>
                  {r.details && <p className="mt-1 text-body">{r.details}</p>}
                  {r.handledAt && (
                    <p className="mt-0.5 text-xs text-mute">
                      Closed by {r.handledBy}: {r.resolution}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`Reported others ${u.reportsMade.length} times`}>
          {u.reportsMade.length === 0 ? (
            <Empty>Never reported anyone.</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {u.reportsMade.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2">
                  <Badge>{r.reason}</Badge>
                  <PersonLink person={r.reported} size={20} />
                  <Time value={r.createdAt} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`Blocked by ${u.blocksReceived.length}`}>
          <PeopleList items={u.blocksReceived} empty="Nobody blocked this account." />
        </Card>
        <Card title={`Blocked ${u.blocksGiven.length}`}>
          <PeopleList items={u.blocksGiven} empty="Blocked nobody." />
        </Card>
      </div>
      <Card title={`Flagged media, ${u.flags.length}`} aside="silent checks of chat and profile photos">
        {u.flags.length === 0 ? (
          <Empty>Nothing flagged.</Empty>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {u.flags.map((f) => (
              <figure key={f.id} className="space-y-1">
                <MediaTile mediaKey={f.key} />
                <figcaption className="text-xs">
                  <Badge tone={f.verdict === "rejected" ? "negative" : "warning"}>{f.context}</Badge>{" "}
                  <span className="text-mute">{f.labels.slice(0, 2).join(", ")}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PeopleList({ items, empty }: { items: { person: UserDetail["blocksGiven"][number]["person"]; createdAt: string }[]; empty: string }) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="space-y-2 text-sm">
      {items.map((b, i) => (
        <li key={i} className="flex items-center justify-between gap-2">
          <PersonLink person={b.person} size={22} />
          <Time value={b.createdAt} />
        </li>
      ))}
    </ul>
  );
}

function Matches({ u, moderator }: { u: UserDetail; moderator: boolean }) {
  return (
    <Card id="matches" title={`Matches, ${u.matches.length}`} aside={moderator ? "opening a conversation asks why, and is logged" : undefined}>
      {u.matches.length === 0 ? (
        <Empty>No match yet.</Empty>
      ) : (
        <Table head={["With", "Matched", "Ended", ""]}>
          {u.matches.map((m) => (
            <tr key={m.id}>
              <td>
                <PersonLink person={m.other} size={22} />
              </td>
              <td>
                <Time value={m.createdAt} />
              </td>
              <td>{m.endedAt ? <Time value={m.endedAt} /> : <span className="text-mute">active</span>}</td>
              <td className="text-right">
                {moderator && (
                  <Link to={`/conversations/${m.id}`} className="text-sm underline">
                    Conversation
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

function Money({ u }: { u: UserDetail }) {
  const w = u.wallet ?? {};
  const premiumUntil = w.premium_until as string | null | undefined;
  return (
    <div id="money" className="scroll-mt-12 grid gap-4 md:grid-cols-2">
      <Card title="Wallet">
        <Facts
          rows={[
            ["drafft tempo", premiumUntil ? <Time key="p" value={premiumUntil} exact /> : null],
            ["Super likes", String(w.super_likes ?? 0)],
            ["Boosts", String(w.boosts ?? 0)],
            ["Boost ends", w.boost_ends_at ? <Time key="b" value={w.boost_ends_at as string} /> : null],
          ]}
        />
        {u.purchases.length > 0 && (
          <div className="mt-4">
            <Table head={["When", "Event", "Effect"]}>
              {u.purchases.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Time value={e.event_at} />
                  </td>
                  <td className="text-xs">
                    {e.type} <span className="text-mute">{e.product_id?.replace("so.drafft.app.", "")}</span>
                    {e.environment === "SANDBOX" && <Badge>sandbox</Badge>}
                  </td>
                  <td className="text-xs text-body">{e.effect}</td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Card>
      <Card title="Support">
        {u.support.length === 0 && u.dataRequests.length === 0 ? (
          <Empty>Never wrote in.</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {u.support.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <Link to={`/support?q=${s.reference}&status=all`} className="hover:underline">
                  <Mono>{s.reference}</Mono> {s.topic}
                </Link>
                {s.handledAt ? <Badge>handled</Badge> : <Badge tone="warning">open</Badge>}
              </li>
            ))}
            {u.dataRequests.map((d) => (
              <li key={`d${d.id}`} className="flex items-center justify-between gap-2">
                <span>
                  Data export asked <Time value={d.created_at} />
                </span>
                {d.fulfilled_at ? <Badge>sent</Badge> : <Badge tone="warning">to send</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const missing = isRouteErrorResponse(error) && error.status === 404;
  return (
    <Page title="Account">
      <Empty>
        {missing ? "No such account." : "This account couldn't be loaded."} <Link to="/accounts" className="underline">Search again</Link>
      </Empty>
    </Page>
  );
}

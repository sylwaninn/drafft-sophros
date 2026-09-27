import { staffContext } from "~/lib/context";
import { can } from "~/lib/roles";
import { query, signedUrl } from "~/lib/.server/db";
import type { Person } from "~/lib/types";
import { ActForm, Button, HoldForm, inputClass } from "~/components/actions";
import { Badge, Card, Empty, MediaTile, Page, PersonLink, Time, useRoot } from "~/components/ui";
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
  // Selfies are only shown to moderators, through 5-minute links; each viewing is logged.
  const selfies = can(staff, "moderator")
    ? await Promise.all(
        queue.selfies.map(async (s) => {
          const paths = await query<{ path: string; createdAt: string }[]>(staff, "admin_selfies", { p_user: s.person.id, p_reason: "verification queue" });
          const urls = await Promise.all(paths.slice(0, 3).map(async (p) => ({ url: await signedUrl("verification-selfies", p.path), createdAt: p.createdAt })));
          return [s.person.id, urls] as const;
        }),
      )
    : [];
  return { queue, selfies: Object.fromEntries(selfies) };
}

function CauseLine({ cause, since }: { cause: Cause | null; since: string }) {
  return (
    <p className="text-xs text-mute">
      {cause?.note ?? "no reason recorded"}
      {cause?.actor ? `, by ${cause.actor}` : ", automatic"}, held <Time value={since} />
    </p>
  );
}

export default function Verifications({ loaderData: { queue, selfies } }: Route.ComponentProps) {
  const { staff } = useRoot();
  const moderator = can(staff, "moderator");
  return (
    <Page title="Verifications" subtitle="Accounts on hold waiting for a person. Oldest first.">
      <div className="space-y-6">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Selfies to compare ({queue.selfies.length})</h2>
          {queue.selfies.length === 0 ? (
            <Card>
              <Empty>No selfie waiting.</Empty>
            </Card>
          ) : (
            <div className="space-y-4">
              {queue.selfies.map((s) => (
                <Card key={s.person.id} title={<PersonLink person={s.person} />} aside={<>selfie sent <Time value={s.selfieAt} /></>}>
                  <CauseLine cause={s.cause} since={s.since} />
                  <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_16rem]">
                    <div>
                      <div className="mb-1 text-xs font-medium text-mute">Selfie</div>
                      {moderator ? (
                        (selfies[s.person.id] ?? []).map((sf, i) =>
                          sf.url ? (
                            <img key={i} src={sf.url} alt="Verification selfie" referrerPolicy="no-referrer" className="mb-2 aspect-[3/4] w-full rounded-lg bg-soft-2 object-cover" />
                          ) : (
                            <Empty key={i}>Selfie file missing.</Empty>
                          ),
                        )
                      ) : (
                        <Empty>Moderators only.</Empty>
                      )}
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-medium text-mute">Profile photos</div>
                      <div className="grid grid-cols-3 gap-2">
                        {s.photos.map((p) => (
                          <div key={p.key} className="relative">
                            <MediaTile mediaKey={p.key} />
                            {p.status !== "approved" && (
                              <span className="absolute top-1 left-1">
                                <Badge tone="warning">{p.status}</Badge>
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    {moderator && <SelfieDecision user={s.person.id} />}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section id="reviews" className="scroll-mt-4">
          <h2 className="mb-2 text-sm font-semibold">Accounts in review ({queue.reviews.length})</h2>
          <Card>
            {queue.reviews.length === 0 ? (
              <Empty>Nobody in review.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {queue.reviews.map((r) => (
                  <li key={r.person.id} className="grid gap-3 py-3 first:pt-0 last:pb-0 md:grid-cols-[1fr_22rem]">
                    <div>
                      <PersonLink person={r.person} />
                      <div className="mt-1 ml-9">
                        <CauseLine cause={r.cause} since={r.since} />
                      </div>
                    </div>
                    <HoldForm user={r.person.id} current="review" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Selfies asked, not sent yet ({queue.waitingSelfie.length})</h2>
          <Card>
            {queue.waitingSelfie.length === 0 ? (
              <Empty>Nobody owes a selfie.</Empty>
            ) : (
              <ul className="space-y-2">
                {queue.waitingSelfie.map((w) => (
                  <li key={w.person.id} className="flex flex-wrap items-center justify-between gap-2">
                    <PersonLink person={w.person} />
                    <CauseLine cause={w.cause} since={w.since} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </Page>
  );
}

/** The three outcomes of a selfie check, each with its reason for the log. */
function SelfieDecision({ user }: { user: string }) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-mute">Decision</div>
      <ActForm intent="hold" fields={{ user, state: "" }} resetOnSuccess>
        {({ pending }) => (
          <>
            <input type="hidden" name="reason" value="selfie matches the photos" />
            <Button tone="lime" pending={pending} className="w-full">
              Same person: lift the hold
            </Button>
          </>
        )}
      </ActForm>
      <ActForm intent="hold" fields={{ user, state: "selfie" }} resetOnSuccess className="space-y-1.5">
        {({ pending }) => (
          <>
            <input name="reason" required placeholder="Why another one: blurry, face hidden" className={inputClass} />
            <Button pending={pending} className="w-full">
              Ask for another selfie
            </Button>
          </>
        )}
      </ActForm>
      <ActForm intent="hold" fields={{ user, state: "banned" }} confirm="Ban this account? Its identities can't come back." resetOnSuccess className="space-y-1.5">
        {({ pending }) => (
          <>
            <input name="reason" required placeholder="Why: not the person in the photos" className={inputClass} />
            <Button tone="danger" pending={pending} className="w-full">
              Not the same person: ban
            </Button>
          </>
        )}
      </ActForm>
    </div>
  );
}

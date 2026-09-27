# sophros

The drafft team's moderation and support dashboard: accounts, holds and bans, selfie checks, reports,
support requests, photo reviews, silently flagged media, conversations, and the audit trail of it all.
One deployment per environment (local, staging, production), each on its own database.

## How it works

```
staff browser ── Cloudflare Access (SSO, MFA, team policy) ── Worker "sophros-<env>"
                                                                 │  verifies the Access JWT
                                                                 │  asks the database who that is
                                                                 ├─ PostgREST: admin_* functions (secret key)
                                                                 ├─ Storage: 5-minute links to selfies
                                                                 └─ Stream REST: conversations, deletions
```

- **React Router (framework mode) on Cloudflare Workers.** Server-rendered pages with loaders and actions:
  the secret key never reaches the browser, forms work without client code, and Access sits in front on
  the same platform as the media bucket. Few runtime dependencies in the process that holds the key.
- **Identity:** Cloudflare Access signs every request (`Cf-Access-Jwt-Assertion`); the Worker verifies
  the token against the team's keys and audience (`app/lib/.server/auth.ts`), so a request that reaches it
  any other way is refused. `*.workers.dev` and preview URLs are off.
- **Authorisation in the database.** The dashboard only calls the `admin_*` functions of drafft-backend
  (`supabase/migrations/20260927000007_sophros.sql`), always naming the staff member. Each function
  checks their role in `private.staff`, then writes `private.admin_audit` (append-only, enforced by a
  trigger). Hiding a button here is comfort; the database decides.
- **Roles**, each with the rights of the one before:

  | Role | Can |
  | --- | --- |
  | `support` | accounts, support requests, reports (read), photo queue (read), notes, mark support handled and exports sent |
  | `moderator` | holds (review, selfie, ban), photos, flagged media, reports, conversations, selfies, sign-out everywhere, message deletion |
  | `admin` | lifting a ban, staff, the whole audit log |

- **Sensitive reads are logged too:** opening an account (`user.view`), a selfie (`selfie.view`), a
  conversation (`conversation.view`, a reason is required and logged on both accounts). Each account page
  shows its staff trail.
- **Headers:** a nonce-based Content-Security-Policy, no framing, no referrer, `noindex`, `no-store`.

## Pages

| Page | What for |
| --- | --- |
| Queues | every queue with its size and oldest case, the longest waiting first; accounts on hold |
| Accounts | search by name, email, phone digits or id; filters (held, flagged, reported, tempo) |
| Account | profile and photos, email and phone, sign-in methods, sessions (IP, client), devices (model, iOS, app version, locale, time zone, IP, country, opens, last opened), IPs, approximate location, usage, holds and their history, reports, blocks, flagged media, related accounts (same install, IP or marked identity), matches, wallet and purchases, support, notes, staff trail; hold, sign out everywhere, approve or refuse photos |
| Verifications | selfie next to the profile photos (lift, ask again, ban), accounts in review with their cause, selfies still owed |
| Reports | open reports with both people, the count of reporters, their conversation; close with a resolution and an optional hold |
| Support | help-form messages with their thread; replies are written here and emailed by the backend in the person's language; data exports to send |
| Photo reviews | profile media the automatic check left pending: second looks first |
| Flagged media | chat and profile photos flagged silently; mark looked at in bulk; most flagged accounts |
| Conversations | every match, filtered by person, name or email, status, a report between them, flagged chat photos, sessions; a conversation opens with a reason; delete a message |
| Audit log, Staff | admins |

## Local development

Against the local Supabase of drafft-backend (its migrations include the `admin_*` functions):

```sh
cd ../drafft-backend && supabase start        # supabase db reset seeds dev@drafft.local as admin
cd ../sophros && pnpm install
scripts/local-env.sh                           # writes .dev.vars (local service role key)
pnpm dev                                        # http://localhost:5173
```

Locally `AUTH_MODE=dev` signs you in as `DEV_STAFF_EMAIL` without Access; the Worker refuses that mode
for any environment but `local`, and answers it on localhost only. Conversations need the Stream staging
key and secret in `.dev.vars`. The local database is the one the app's **Drafft Local** scheme uses:
actions here really happen there (holds reach the app live, a lifted hold deletes the selfies and emails
the person).

Demo data, local database only: `scripts/demo.sh up` adds 14 accounts covering every case (a ban and a
new account on the same iPhone, a selfie to compare, reports, flagged chat photos, support requests),
`scripts/demo.sh down` removes them. They go in with triggers off (no email, push, Stream or R2 call) and
never show in the app's Discover. Their pictures are stock placeholders (i.pravatar.cc portraits, picsum.photos
scenes) copied to the local Storage, and their conversations are canned (Stream isn't needed locally).

Checks: `pnpm typecheck && pnpm test && pnpm build`.

## Deploying

Per environment (`staging` first, then `production`):

1. **Access.** Zero Trust > Access > Applications > Self-hosted: `sophros-staging.getdrafft.com` (or
   `sophros.getdrafft.com`), a policy allowing only the team's emails or identity-provider group, with
   MFA. Copy the Application Audience (AUD) tag and the team domain into `ACCESS_AUD` and
   `ACCESS_TEAM_DOMAIN` of that environment in `wrangler.jsonc`.
2. **Staff**, in that environment's database (SQL editor): at least one admin, who adds the rest from the
   Staff page.
   ```sql
   insert into private.staff (email, role) values ('you@getdrafft.com', 'admin');
   ```
3. **Secrets**, typed in, never committed:
   ```sh
   pnpm exec wrangler secret put SUPABASE_SECRET_KEY --env staging   # an sb_secret_ key made for sophros
   pnpm exec wrangler secret put STREAM_API_KEY --env staging
   pnpm exec wrangler secret put STREAM_API_SECRET --env staging
   ```
   Give sophros its own secret key (Supabase > Settings > API keys) so it can be revoked alone.
4. `pnpm run deploy:staging`, or `pnpm run deploy:production` (asks to type `production`).

The Worker is only reachable on its custom domain, behind Access. A request without a valid Access token
gets a 401, and a valid person who isn't in `private.staff` a 403.

## Data and privacy

sophros stores nothing itself. Device reports (model, iOS, app version, locale, time zone, IP, country)
come from the app's `report_app_open` and are pruned by the database (IPs after 180 days without use,
devices after a year). The privacy policy must say so, and that staff may read conversations when a
report or an investigation calls for it.

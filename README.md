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

  | Role        | Can                                                                                                                        |
  | ----------- | -------------------------------------------------------------------------------------------------------------------------- |
  | `support`   | accounts, support requests, reports (read), photo queue (read), notes, mark support handled and exports sent               |
  | `moderator` | holds (review, selfie, ban), photos, flagged media, reports, conversations, selfies, sign-out everywhere, message deletion |
  | `admin`     | lifting a ban, staff, the whole audit log                                                                                  |

- **Sensitive reads are logged too:** opening an account (`user.view`), a selfie (`selfie.view`), a
  conversation (`conversation.view`, on both accounts, with where it was opened from). Selfies and
  conversations open only for a reason the person types (see below). Each account page shows its staff
  trail.
- **Headers:** a nonce-based Content-Security-Policy, no framing, no referrer, `noindex`, `no-store`.

## Reasons and access

Since drafft-backend migration `20260930000401_moderation_reasons_and_chat_access` (backend pull request
[#52](https://github.com/sylwaninn/drafft-backend/pull/52)).

**Decisions the member is told about** (DSA art. 17 statement of reasons): putting or changing a hold
(review, selfie, ban), refusing a profile photo, deleting a chat message. Every form that makes one asks
for three things:

| Field           | Posted as  | Goes to                                                                                                                                                          |
| --------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reason told     | `category` | the member, by email and push in their language, with the part of the terms it falls under; required, from `admin_reason_categories` (loaded by the root loader) |
| Note for them   | `details`  | the member, sent as written (not translated), 1,000 characters at most; optional                                                                                 |
| Internal reason | `reason`   | the audit and moderation logs only                                                                                                                               |

`/act` refuses such a decision without a category before calling the database (without one the database
would tell the member `other`); the database refuses an unknown one (`invalid_category`, nothing applied).
Where the decision itself says why, the category is preselected and can be changed: a selfie request
(`identity_check`), a refused photo (`photo_guidelines`); never for a ban. Staff labels and the links to
getdrafft.com/terms are in `app/lib/reasons.ts`. Decisions that tell the member nothing ask only for the
internal reason: lifting a hold (they're emailed that they're back), approving a photo, keeping an
automatic refusal (they were told then), marking a flagged chat photo as fine, closing a report without a
hold.

| Decision                                      | Function                                                |
| --------------------------------------------- | ------------------------------------------------------- |
| Restrict, ask for a selfie again, ban         | `admin_set_hold`                                        |
| Refuse a photo (account page, Profile photos) | `admin_review_media`                                    |
| Refuse and hold or ban (Profile photos)       | `admin_decide_photo`                                    |
| Hold, selfie or ban from a chat photo         | `admin_decide_flags`                                    |
| Close a report with a hold                    | `admin_close_report`                                    |
| Delete a message (conversation drawer)        | `admin_log('message.delete')`, author told once removed |

**Reading a conversation.** The drawer first asks `admin_conversation_access` (nothing read, nothing
logged) and shows the basis the database finds: a report between the two, a help request from either
(open or from the last 90 days), either account on hold or banned. The messages load only once the person
types why (`conversation-data` action, posted so the reason stays out of URLs); the reading is logged on
both accounts with that reason and where it was opened from. Without a basis, a moderator can't read it
(`no_basis`); an admin can, as an override confirmed in a second dialog and logged as one. Deleting a
message needs the same basis or override, checked again by the database. There is no default reason any
more: "opened in sophros" is refused (`reason_required`).

**Viewing a selfie.** Verifications no longer signs the selfie in its loader: each case shows a field to
say why, and `selfie-data` logs the viewing (`admin_selfies`, reason required) and returns a 5-minute
link.

## Pages

| Page             | What for                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queues           | every queue with its size and oldest case, the longest waiting first; accounts on hold                                                                                                                                                                                                                                                                                                                                                 |
| Accounts         | search by name, email, phone digits or id; filters (held, flagged, reported, tempo)                                                                                                                                                                                                                                                                                                                                                    |
| Account          | profile and photos, email and phone, sign-in methods, sessions (IP, client), devices (model, iOS, app version, locale, time zone, IP, country, opens, last opened), IPs, approximate location, usage, holds and their history, reports, blocks, flagged media, related accounts (same install, IP or marked identity), matches, wallet and purchases, support, notes, staff trail; hold, sign out everywhere, approve or refuse photos |
| Verifications    | selfie (opened for a typed reason) next to the profile photos (lift, ask again, ban), accounts in review, selfies owed                                                                                                                                                                                                                                                                                                                 |
| Reports          | open reports with both people, the count of reporters, their conversation; close with a resolution and an optional hold                                                                                                                                                                                                                                                                                                                |
| Support          | help-form messages with their thread; replies are written here and emailed by the backend in the person's language; data exports to send                                                                                                                                                                                                                                                                                               |
| Profile photos   | one by one: pending photos (approve, refuse) and ones refused automatically (keep, approve anyway); refuse and hold or ban                                                                                                                                                                                                                                                                                                             |
| Shared media     | one by one: chat photos the silent check flagged, already delivered; act on the sender (fine, hold, selfie, ban); history and most flagged                                                                                                                                                                                                                                                                                             |
| Conversations    | every match, filtered by person, name or email, status, a report between them, flagged chat photos, sessions; a conversation opens with its basis and a typed reason; delete a message                                                                                                                                                                                                                                                 |
| Audit log, Staff | admins                                                                                                                                                                                                                                                                                                                                                                                                                                 |

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

Checks, as CI runs them: `pnpm verify` (types, lint, format, tests, build); `pnpm format` fixes formatting.

## Deploying

**With drafft-backend.** sophros calls the backend's `admin_*` functions by their named arguments, so the
two ship in order, per environment:

1. drafft-backend [#52](https://github.com/sylwaninn/drafft-backend/pull/52) (reasons and conversation
   access) first. From then on the sophros deployed before it can no longer open a conversation (it sends
   the refused default "opened in sophros", and nothing for a match without a basis), and its decisions
   reach members as `other`.
2. This version of sophros right after: it sends `p_category`, `p_details` and `p_override`, and calls
   `admin_reason_categories` and `admin_conversation_access`, which don't exist before #52 (its decisions
   would fail).

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
   pnpm exec wrangler secret put MEDIA_SIGNING_KEY --env staging    # the backend's MEDIA_SIGNING_KEY for staging
   ```
   Give sophros its own secret key (Supabase > Settings > API keys) so it can be revoked alone.
4. Deploys run from GitHub Actions (`.github/workflows/ci.yml`), never from a laptop:

   | Branch    | Deploys              | How it changes                      |
   | --------- | -------------------- | ----------------------------------- |
   | `staging` | `sophros-staging`    | pull requests from feature branches |
   | `main`    | `sophros-production` | pull requests from `staging`        |

   Every pull request runs: its title (`type(scope): description`), quality (types, ESLint with React hooks
   and accessibility rules, Prettier, tests, build), a dry-run bundle of the Worker for both environments,
   and security (`pnpm audit`, gitleaks over the whole history, actionlint, zizmor, shellcheck). A deploy
   then smoke-tests the domain: it must redirect to Access, never answer without it. Actions are pinned to a
   commit and Dependabot proposes updates weekly, into `staging`.

   The repository needs the secret `CLOUDFLARE_API_TOKEN` (Cloudflare > My Profile > API Tokens > template
   "Edit Cloudflare Workers", this account and the `getdrafft.com` zone) and the variable
   `CLOUDFLARE_ACCOUNT_ID`. By hand, in an emergency, from a machine logged in with `wrangler login`:
   `pnpm run deploy:staging`, or `pnpm run deploy:production` (asks to type `production`).

The Worker is only reachable on its custom domain, behind Access. A request without a valid Access token
gets a 401, and a valid person who isn't in `private.staff` a 403.

## Data and privacy

sophros stores nothing itself. Device reports (model, iOS, app version, locale, time zone, IP, country)
come from the app's `report_app_open` and are pruned by the database (IPs after 180 days without use,
devices after a year). The privacy policy must say so, and that staff may read conversations when a
report, a help request or a hold calls for it (enforced by the database; an admin's override is logged as
one).

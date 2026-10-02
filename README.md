<div align="center">

<img src="docs/sticker.png" alt="drafft sophros" width="480">

The drafft team's moderation and support dashboard.<br>
Accounts, holds and bans, selfie checks, reports, photo reviews, support requests, and the audit trail of it all.

[![ci](https://github.com/sylwaninn/drafft-sophros/actions/workflows/ci.yml/badge.svg?branch=staging)](https://github.com/sylwaninn/drafft-sophros/actions/workflows/ci.yml)
[![pr](https://github.com/sylwaninn/drafft-sophros/actions/workflows/pr.yml/badge.svg)](https://github.com/sylwaninn/drafft-sophros/actions/workflows/pr.yml)
![React Router](https://img.shields.io/badge/React%20Router-8-CA4245?logo=reactrouter&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20%2B%20Access-F38020?logo=cloudflare&logoColor=white)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

</div>

## How it works

A React Router app (framework mode, server-rendered) on Cloudflare Workers, Tailwind 4. One Worker per
environment, reachable only on its custom domain behind Cloudflare Access. sophros stores nothing itself:
every database read and change goes through drafft-backend's `admin_*` functions; messages come from Stream,
selfies from Supabase Storage, photos and videos from the media Worker.

```mermaid
flowchart LR
  Staff["Staff browser"] --> Access["Cloudflare Access<br/>SSO, MFA"]
  Access --> Worker["Worker<br/>sophros-staging,<br/>sophros-production"]
  Worker -- "admin_* RPCs<br/>secret key" --> Postgres[("Supabase Postgres<br/>drafft-backend")]
  Worker -- "signed links, 5 min" --> Storage["Supabase Storage<br/>verification-selfies"]
  Worker -- "server JWT" --> Stream["Stream Chat REST"]
  Worker -- "/live socket" --> Live["Durable Object<br/>LiveQueues"]
  Live -- "Realtime, topic staff:queues" --> Postgres
  Staff -- "signed link,<br/>after /media" --> Media["media Worker"]
```

### Every request

1. **Origin.** Any request but GET and HEAD must carry an `Origin` header equal to sophros's own; otherwise
   a 403.
2. **Access.** The Worker reads the Access token (`cf-access-jwt-assertion` header or `CF_Authorization`
   cookie) and verifies it against the team's keys: issuer, audience (`ACCESS_AUD`), RS256, expiry. A missing
   or invalid token gets a 401. Locally, `AUTH_MODE=dev` replaces this step with `DEV_STAFF_EMAIL`, on
   localhost only (see [Getting started](#getting-started)).
3. **Staff.** `admin_whoami(email)` returns the person's role in this environment's database; no role, a 403.
4. **Headers.** HTML gets a Content-Security-Policy with a fresh nonce; every response gets `DENY` framing, no
   referrer, `noindex`, HSTS, and `private, no-store` unless the route sets its own cache rule. The `/live`
   socket upgrade is passed through untouched.

### Reading and acting

- **Reads.** Each page's loader calls `admin_*` functions through PostgREST with the secret key, which never
  reaches the browser. The signed-in email is always passed as `p_actor`, last, so no field can replace it.
- **Changes.** Mostly through one action endpoint, `/act`, which maps each form's `intent` to an `admin_*`
  function (holds, photo decisions, reports, support replies, notes, staff, failed events, account
  deletion). Sensitive reads post to their own actions, `conversation-data` and `selfie-data`. A decision
  the member is told about needs a reason category from `admin_reason_categories` and takes an optional note
  of 1,000 characters at most, checked here and again by the database.
- **Message deletion.** `admin_log('message.delete')` with a reason category and the same basis as a
  reading, then Stream's delete.
- **Roles.** The interface hides what a role can't do; the database decides. Each `admin_*` function checks
  the role and writes the audit log; a refusal (`forbidden`) is a 403 page for a page's reads, and an error
  inside the dialog for an action.

### Sensitive reads

| Read           | Flow                                                                                                                                                                                                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conversation   | `admin_conversation_access` shows the basis (a report between the two, a help request from either, a hold on either put by someone other than the reader) without reading anything. The person types a reason; `admin_log('conversation.view')` records it on both accounts; then the Worker reads the match's Stream channel (80 messages a page) |
| Selfie         | a typed reason; `admin_selfies` logs `selfie.view`; Storage signs a 5-minute link                                                                                                                                                                                                                                                                  |
| Photo or video | `/media/<key>` answers a redirect to a signed link of the media Worker (HMAC-SHA256, valid at least an hour)                                                                                                                                                                                                                                       |

Rules, overrides and refusal codes: [docs/moderation.md](docs/moderation.md).

### Live counters

One Durable Object per environment holds a single Supabase Realtime connection on the private topic
`staff:queues`. Browsers connect to it through `/live` (same origin, Access and role checked); each queue change
makes the open page read again. A browser socket closes after an hour, so Access and the role are checked again
on reconnect. Queue counters are also read again after every action, and on navigation once a minute old.

## Roles

Each role has the rights of the one before.

| Role        | Can                                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| `support`   | accounts, support requests, reports, verifications and photo queue (read), notes, mark requests handled and exports sent   |
| `moderator` | holds (review, selfie, ban), photos, flagged media, reports, conversations, selfies, sign-out everywhere, message deletion |
| `admin`     | lifting a ban, staff, the whole audit log, failed events, deleting an account at the member's request                      |

## Pages

The sidebar's labels:

| Page                            | What for                                                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| What's waiting                  | every queue with its size and oldest case; accounts on hold                                                                            |
| Verifications                   | selfie next to the profile photos: lift, ask again, ban                                                                                |
| Profile photos                  | pending photos and automatic refusals, one by one                                                                                      |
| Shared media                    | chat photos the silent check flagged; act on the sender                                                                                |
| Reports                         | open reports with both people and their conversation; close, with an optional hold                                                     |
| Accounts                        | search by name, email, phone or id; filter held, flagged, reported, tempo                                                              |
| Account                         | everything about one account (profile, devices, holds, reports, matches, purchases, support, notes, staff trail) and the actions on it |
| Conversations                   | every match, filtered; open one with its basis and a reason                                                                            |
| Requests                        | requests from the help forms and the support address, with their thread; replies emailed by the backend                                |
| Data exports                    | export requests to send; mark them sent                                                                                                |
| Audit log, Failed events, Staff | admins only; Failed events lists the side effects the backend gave up on: replay or discard                                            |

## Getting started

Runs against the local Supabase of drafft-backend, whose migrations hold the `admin_*` functions.

```sh
(cd ../drafft-backend && supabase start)   # first start or `supabase db reset` seeds dev@drafft.local as admin
pnpm install
scripts/local-env.sh                       # writes .dev.vars (local service role key)
pnpm dev                                   # http://localhost:5173
```

Locally `AUTH_MODE=dev` signs you in as `DEV_STAFF_EMAIL` without Access; the Worker refuses that mode outside
`local` and answers it on localhost only. Real conversations need the Stream staging key and secret in
`.dev.vars`; without them, conversations show canned demo messages.

Actions here really happen on the database the iOS `Drafft Local` scheme and the Android local build use: holds
reach the app live, and lifting a hold deletes the selfies and emails the person.

`scripts/demo.sh up` adds 14 local accounts covering every case (a ban and a new account on the same phone, a
selfie to compare, reports, flagged chat photos, support requests); `scripts/demo.sh down` removes them. They go
in with triggers off (no email, push, Stream or R2 call) and never show in the apps' Discover.

| Command       | What                                                          |
| ------------- | ------------------------------------------------------------- |
| `pnpm verify` | types, lint, format, tests, build: what CI's quality job runs |
| `pnpm format` | fix formatting                                                |

## Deploy

| When                            | CI                                                                                                                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pull request into `staging`     | `ci.yml`: title format; types, ESLint, Prettier, tests, build; Worker bundle for both environments; `pnpm audit`, gitleaks, actionlint, zizmor, shellcheck. `pr.yml`: base branch, description, commit authors, no AI attribution, a warning on unsigned commits |
| Merge into `staging`            | `ci.yml`: the same checks, then deploy `sophros-staging`                                                                                                                                                                                                         |
| Release (**Actions > release**) | `main` fast-forwards to `staging`, a `vX.Y.Z` tag, then `ci.yml` deploys `sophros-production` from the tag                                                                                                                                                       |

After each deploy, a smoke test requires the domain to redirect to Access: a page served without it fails the
run. Deploys run from GitHub Actions; a deploy from a laptop is for emergencies only. Access setup, staff,
secrets, rollback and the emergency deploy: [docs/deployment.md](docs/deployment.md).

## Documentation

| Document                                         | Read it when you                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [docs/moderation.md](docs/moderation.md)         | touch a decision the member is told about, a sensitive read or an account deletion |
| [docs/deployment.md](docs/deployment.md)         | set up an environment, a secret or a deploy                                        |
| [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md) | need the users and the interface rules                                             |
| [AGENTS.md](AGENTS.md)                           | run a coding agent, or need the repository rules                                   |

A new capability starts in drafft-backend, with an `admin_*` function, its role check and its audit line,
then a page here.

## Related repositories

| Repository                                                    | Role                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| [drafft-backend](https://github.com/sylwaninn/drafft-backend) | the `admin_*` functions, moderation and retention rules |
| [drafft-ios](https://github.com/sylwaninn/drafft-ios)         | iPhone app                                              |
| [drafft-android](https://github.com/sylwaninn/drafft-android) | Android app                                             |
| [drafft-web](https://github.com/sylwaninn/drafft-web)         | getdrafft.com and the legal pages                       |

## License

Proprietary. Copyright © 2026 the drafft authors. All rights reserved. No permission is granted to use, copy,
modify or distribute this code without written consent.

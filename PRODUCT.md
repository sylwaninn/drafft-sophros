# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The founder of drafft (a dating app built around sport sessions), moderating alone for now: short desktop
sessions to clear the queues, longer ones when an account needs investigating. A small team (support,
moderators) joins later; roles already exist for them.

## Product Purpose

sophros is drafft's moderation and support console, one deployment per environment (local, staging,
production). It exists so every safety decision on drafft is quick to make, well informed, and
justified: clear the queues, investigate an account before acting, answer members, and prove afterwards
who did what and why. Success is an empty queue with no wrong ban, and an audit trail that answers any
question about a decision.

## Positioning

Built on drafft's own safety mechanics rather than a generic admin panel: holds (review, selfie, ban)
that freeze an account and follow the person through identity marks and DeviceCheck, silent checks of
chat photos, selfies compared with profile photos, and the database itself enforcing roles and writing an
append-only audit log.

## Operating Context

- Work arrives as queues: selfies to compare, accounts held for review, reports, support requests, data
  exports, photos waiting for a person, silently flagged media.
- Investigation of one account crosses profile and photos, email and phone, sign-in methods, sessions,
  devices (model, iOS, app version, locale, time zone), IPs and countries, approximate location, holds
  and their history, reports, blocks, flags, related accounts (same install, IP or marked identity),
  matches and conversations, purchases, support, staff notes.
- Every action takes a reason; reading a conversation or a selfie is logged too.
- Desktop browser, behind Cloudflare Access; the environment (local, staging, production) must be
  unmistakable.

## Capabilities and Constraints

- Interface language: English.
- React Router 8 (framework mode) on Cloudflare Workers; data only through the `admin_*` functions of
  drafft-backend. Roles: support, moderator, admin.
- Moderation focus: no usage or growth statistics in this product.
- Conversations come from Stream Chat; media from the media CDN; selfies through 5-minute signed links.
- Local demo data (`scripts/demo.sh`) for trying every case without real members.

## Brand Commitments

- Standard shadcn/ui admin, executed straight (the user chose it over bespoke directions): only shadcn/ui
  components (radix base, Nova preset: Lucide icons, Geist), decoupled from the drafft app's own design
  system. Modern, professional, animated where motion explains state.
- The product name is lowercase: sophros.

## Evidence on Hand

No real member data in the repository. Demo accounts and pictures only, local database only.

## Product Principles

1. Decide with the whole picture: the evidence for a decision sits next to the action.
2. Every decision is justified and traceable; nothing happens silently.
3. The queue is the unit of work: show what waits, oldest first, and get out of the way.
4. Destructive actions are deliberate; reversible ones are fast.
5. Least exposure: private content (conversations, selfies) is opened for a reason, not browsed.

## Accessibility & Inclusion

Keyboard operable, readable contrast, reduced motion respected.

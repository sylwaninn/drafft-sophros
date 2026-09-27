# Design

sophros is a standard shadcn/ui admin, deliberately separate from the drafft app's design system.

## System

- **Components:** shadcn/ui only (`app/components/ui`, radix base, preset Nova), added with
  `pnpm dlx shadcn@latest add <name>`. App pieces in `app/components/app` are compositions of them
  (`Panel` = Card, `Nothing` = Empty, `ReasonDialog` = Dialog or AlertDialog + Field + Textarea,
  `HoldMenu` = DropdownMenu, `PersonLink` = Avatar + HoverCard). No hand-made control.
- **Layout:** Sidebar (inset, collapsible to icons, `⌘B`) with the queues and their counts, a sticky
  header with breadcrumb and `⌘K` search (Command), pages at `max-w-7xl`. Lists are Table inside Card;
  details open in a Sheet; decisions in a Dialog, bans and deletions in an AlertDialog.
- **Theme:** shadcn neutral tokens (`app/app.css`), dark by default (moderating photos, often in the
  evening), light from the account menu (cookie, rendered server side). Geist and Geist Mono, tabular
  numerals in tables and badges.
- **Holds** are the only semantic colours: `--review` (amber), `--selfie` (sky), `--banned` (red),
  `--cleared` (green), as tinted secondary badges with an icon (`HoldBadge`).

## Holds and photos

- Two controls on an account, always: **Restrict** (menu: hold for review, ask for a selfie, ban; each
  asks why, a ban in an alert dialog) and **Unblock** (shown when the account is held; confirms and asks
  why; lifting a ban takes an admin).
- A photo never opens a new tab: clicking one opens it large in a dialog (`PhotoViewer`), with ← and →
  through the rest of its set and the keys shown on screen.
- The selfie check shows one case at a time: the selfie and one profile photo side by side at the same
  size, ← and → through the photos, the other cases waiting underneath.
- Two photo flows, one item at a time, large, with the account behind it alongside. **Profile
  photos**: pending ones (approve, refuse) and ones refused automatically (keep refused, approve
  anyway), plus refuse-and-hold or refuse-and-ban. **Shared media**: chat photos already delivered, so
  only the sender's account is acted on (nothing wrong, hold, selfie, ban). Letters decide (shown on each
  button) and apply at once; ← → move.
- Conversations open in a drawer, readable at once; each reading is logged with where it was opened from.
- Media never bleed to a card's edge: photo tiles stand on their own (ring, rounded-xl) with the caption
  below, and a radius nested inside padding is the outer radius minus the padding.

## Motion

- One authored moment: a resolved case leaves its queue (fade, slight scale, blur) while the rest close
  the gap, and the sidebar count rolls to its new value (`motion`, `app/components/app/motion.tsx`).
- Page changes cross-fade in 160 ms (view transitions); overlays use shadcn's tw-animate-css.
- Everything respects `prefers-reduced-motion`.

## Copy

English, sentence case, verbs on buttons ("Close the report", "Same person: lift the hold"). Every
action that changes an account asks why, and says the reason goes to the audit log.

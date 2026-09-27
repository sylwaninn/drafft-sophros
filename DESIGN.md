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

## Motion

- One authored moment: a resolved case leaves its queue (fade, slight scale, blur) while the rest close
  the gap, and the sidebar count rolls to its new value (`motion`, `app/components/app/motion.tsx`).
- Page changes cross-fade in 160 ms (view transitions); overlays use shadcn's tw-animate-css.
- Everything respects `prefers-reduced-motion`.

## Copy

English, sentence case, verbs on buttons ("Close the report", "Same person: lift the hold"). Every
action that changes an account asks why, and says the reason goes to the audit log.

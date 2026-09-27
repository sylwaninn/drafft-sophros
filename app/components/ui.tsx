import type { ReactNode } from "react";
import { Link, useRouteLoaderData } from "react-router";
import type { Hold, Person } from "~/lib/types";
import type { Staff } from "~/lib/roles";

export interface RootData {
  staff: Staff;
  env: "local" | "staging" | "production";
  mediaUrl: string;
  demoMediaUrl: string | null;
  counts: Record<string, number>;
}

export function useRoot(): RootData {
  const data = useRouteLoaderData("root") as RootData | undefined;
  if (!data) throw new Error("root data missing");
  return data;
}

export function useMediaUrl() {
  const { mediaUrl, demoMediaUrl } = useRoot();
  return (key: string | null | undefined) =>
    key ? `${demoMediaUrl && key.includes("/demo/") ? demoMediaUrl : mediaUrl}/${key}` : null;
}

export function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

// MARK: Layout

export function Page({ title, subtitle, actions, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-mute">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}

export function Card({ title, aside, children, className, id }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cx("rounded-xl border border-line bg-canvas scroll-mt-4", className)}>
      {(title || aside) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {aside && <div className="text-xs text-mute">{aside}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-mute">{children}</p>;
}

export function Tabs({ items }: { items: { label: ReactNode; to: string; active: boolean; count?: number }[] }) {
  return (
    <nav className="mb-4 flex gap-1 rounded-lg bg-soft-2 p-1 text-sm w-fit">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={cx("rounded-md px-3 py-1.5 font-medium", item.active ? "bg-canvas shadow-sm" : "text-body hover:text-ink")}
        >
          {item.label}
          {item.count ? <span className="ml-1.5 text-mute">{item.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/** Label/value rows. */
export function Facts({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">
      {rows.map(([label, value], i) => (
        <div key={i} className="contents">
          <dt className="text-mute">{label}</dt>
          <dd className="min-w-0 break-words">{value ?? <span className="text-mute">none</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-mute">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap border-b border-line px-2 py-2 font-medium first:pl-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-line/70 [&_td]:px-2 [&_td]:py-2 [&_td:first-child]:pl-0 [&_tr:last-child_td]:border-0">
          {children}
        </tbody>
      </table>
    </div>
  );
}

// MARK: Bits

const tones = {
  neutral: "bg-soft-2 text-body",
  lime: "bg-lime-pale text-lime-deep",
  warning: "bg-warning-pale text-warning-deep",
  negative: "bg-negative-pale text-negative-deep",
  cyan: "bg-cyan-pale text-cyan-deep",
  ink: "bg-ink text-canvas",
} as const;

export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export const holdLabels: Record<Hold, string> = { review: "In review", selfie: "Selfie asked", banned: "Banned" };
const holdTones: Record<Hold, Tone> = { review: "warning", selfie: "cyan", banned: "negative" };

export function HoldBadge({ hold }: { hold: Hold | null | undefined }) {
  if (!hold) return null;
  return <Badge tone={holdTones[hold]}>{holdLabels[hold]}</Badge>;
}

export function Avatar({ photo, name, size = 32 }: { photo?: string | null; name?: string; size?: number }) {
  const url = useMediaUrl()(photo);
  const style = { width: size, height: size };
  if (!url) {
    return (
      <span style={style} className="inline-flex shrink-0 items-center justify-center rounded-full bg-soft-2 text-xs font-semibold text-mute">
        {(name || "?").slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img src={url} alt="" style={style} loading="lazy" referrerPolicy="no-referrer" className="shrink-0 rounded-full bg-soft-2 object-cover" />;
}

export function PersonLink({ person, size = 28, showHold = true }: { person: Person | null | undefined; size?: number; showHold?: boolean }) {
  if (!person) return <span className="text-mute">nobody</span>;
  if (person.deleted) return <span className="text-mute" title={person.id}>deleted account</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar photo={person.photo} name={person.name} size={size} />
      <Link to={`/accounts/${person.id}`} className="truncate font-medium hover:underline">
        {person.name || <span className="text-mute">no name yet</span>}
      </Link>
      {showHold && <HoldBadge hold={person.moderation} />}
    </span>
  );
}

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });

export function formatDate(value: string | null | undefined) {
  return value ? dateTime.format(new Date(value)) : "";
}

export function ago(value: string | Date, now = Date.now()) {
  const seconds = Math.round((now - new Date(value).getTime()) / 1000);
  const abs = Math.abs(seconds);
  const [n, unit] =
    abs < 60 ? [abs, "s"] : abs < 3600 ? [Math.floor(abs / 60), "min"] : abs < 86400 ? [Math.floor(abs / 3600), "h"] : abs < 86400 * 60 ? [Math.floor(abs / 86400), "d"] : [Math.floor(abs / (86400 * 30)), "mo"];
  return seconds >= 0 ? `${n} ${unit} ago` : `in ${n} ${unit}`;
}

/** Relative time, the exact date on hover (Paris time). */
export function Time({ value, exact = false }: { value: string | null | undefined; exact?: boolean }) {
  if (!value) return <span className="text-mute">never</span>;
  return (
    <time dateTime={value} title={formatDate(value)} suppressHydrationWarning className="whitespace-nowrap">
      {exact ? formatDate(value) : ago(value)}
    </time>
  );
}

export function Mono({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <code title={title} className="rounded bg-soft px-1 py-0.5 font-mono text-[0.8em] text-body break-all">
      {children}
    </code>
  );
}

export function Stat({ label, value, to, tone }: { label: string; value: ReactNode; to?: string; tone?: "alert" }) {
  const body = (
    <>
      <div className="text-xs text-mute">{label}</div>
      <div className={cx("mt-1 text-2xl font-semibold tracking-tight", tone === "alert" && "text-negative-deep")}>{value}</div>
    </>
  );
  const cls = "block rounded-xl border border-line bg-canvas px-4 py-3";
  return to ? (
    <Link to={to} className={cx(cls, "hover:border-ink/30")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A photo or video from the media bucket. */
export function MediaTile({ mediaKey, kind, posterKey, className }: { mediaKey: string; kind?: string; posterKey?: string | null; className?: string }) {
  const url = useMediaUrl();
  const isVideo = kind === "video" || /\.(mp4|mov|m4v)$/i.test(mediaKey);
  const cls = cx("aspect-[3/4] w-full rounded-lg bg-soft-2 object-cover", className);
  if (isVideo) {
    return <video src={url(mediaKey) ?? undefined} poster={url(posterKey) ?? undefined} controls preload="none" className={cls} />;
  }
  return (
    <a href={url(mediaKey) ?? undefined} target="_blank" rel="noreferrer noopener">
      <img src={url(mediaKey) ?? undefined} alt="" loading="lazy" referrerPolicy="no-referrer" className={cls} />
    </a>
  );
}

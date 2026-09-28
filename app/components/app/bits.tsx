// Small building blocks of sophros, each made of shadcn/ui primitives.
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { CircleCheckIcon, ImageOffIcon, ScanFaceIcon, ShieldBanIcon, ShieldQuestionIcon, Trash2Icon } from "lucide-react";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "~/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import type { Hold, Person } from "~/lib/types";
import { ago, formatDate } from "./format";
import { isVideo, PhotoViewer, type ViewerMedia } from "./photo-viewer";
import { useMediaUrl } from "./root-data";

// MARK: Page

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6", className)}>{children}</div>;
}

/** A titled card, the one container of every page. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  id?: string;
}) {
  return (
    <Card id={id} className={cn("scroll-mt-20", className)}>
      {(title || description || action) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export function Nothing({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <Empty className="border-0 py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon ?? <CircleCheckIcon />}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {children && <EmptyDescription>{children}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  );
}

// MARK: Holds

const holds: Record<Hold, { label: string; icon: typeof ShieldBanIcon; className: string }> = {
  review: { label: "In review", icon: ShieldQuestionIcon, className: "bg-review/12 text-review" },
  selfie: { label: "Selfie asked", icon: ScanFaceIcon, className: "bg-selfie/12 text-selfie" },
  banned: { label: "Banned", icon: ShieldBanIcon, className: "bg-banned/12 text-banned" },
};

export const holdLabel = (hold: Hold) => holds[hold].label;

/** Deleted by its owner, kept for members' safety. */
export function DeletedBadge({ at, className }: { at: string | null | undefined; className?: string }) {
  if (!at) return null;
  return (
    <Badge variant="outline" className={cn("text-muted-foreground", className)}>
      <Trash2Icon data-icon="inline-start" />
      Deleted
    </Badge>
  );
}

export function HoldBadge({ hold, className }: { hold: Hold | null | undefined; className?: string }) {
  if (!hold) return null;
  const { label, icon: Icon, className: tone } = holds[hold];
  return (
    <Badge variant="secondary" className={cn(tone, className)}>
      <Icon data-icon="inline-start" />
      {label}
    </Badge>
  );
}

// MARK: People

export function PersonAvatar({ person, className }: { person: Pick<Person, "name" | "photo"> | null | undefined; className?: string }) {
  const url = useMediaUrl();
  return (
    <Avatar className={className}>
      <AvatarImage src={url(person?.photo)} alt="" className="object-cover" referrerPolicy="no-referrer" />
      <AvatarFallback>{(person?.name || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

/** An account: photo, name linking to it, hold; hovering shows a larger preview. */
export function PersonLink({
  person,
  showHold = true,
  className,
}: {
  person: Person | null | undefined;
  showHold?: boolean;
  className?: string;
}) {
  const url = useMediaUrl();
  if (!person) return <span className="text-muted-foreground">Nobody</span>;
  if (person.deleted) {
    return (
      <span className="text-muted-foreground" title={person.id}>
        Deleted account
      </span>
    );
  }
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <HoverCard openDelay={300}>
        <HoverCardTrigger asChild>
          <Link to={`/accounts/${person.id}`} viewTransition className="inline-flex min-w-0 items-center gap-2 font-medium hover:underline">
            <PersonAvatar person={person} className="size-6" />
            <span className="truncate">{person.name || "No name yet"}</span>
          </Link>
        </HoverCardTrigger>
        <HoverCardContent className="w-64" align="start">
          <div className="flex gap-3">
            {person.photo ? (
              <img src={url(person.photo)} alt="" referrerPolicy="no-referrer" className="size-16 rounded-md object-cover" />
            ) : (
              <PersonAvatar person={person} className="size-16" />
            )}
            <div className="min-w-0 space-y-1">
              <div className="truncate font-medium">{person.name || "No name yet"}</div>
              <HoldBadge hold={person.moderation} />
              <DeletedBadge at={person.deletedAt} />
              <div className="truncate font-mono text-xs text-muted-foreground">{person.id.slice(0, 8)}</div>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
      {showHold && <HoldBadge hold={person.moderation} />}
      {showHold && <DeletedBadge at={person.deletedAt} />}
    </span>
  );
}

// MARK: Time and media

export function TimeAgo({ value, exact = false, className }: { value: string | null | undefined; exact?: boolean; className?: string }) {
  if (!value) return <span className="text-muted-foreground">Never</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={value} suppressHydrationWarning className={cn("whitespace-nowrap", className)}>
          {exact ? formatDate(value) : ago(value)}
        </time>
      </TooltipTrigger>
      <TooltipContent>{formatDate(value)} Paris</TooltipContent>
    </Tooltip>
  );
}

/**
 * A photo or video from the media bucket, at 3:4 like the app shows them. Clicking opens it large in a
 * dialog; with a `gallery`, ← and → then move through its other photos.
 */
export function MediaTile({
  mediaKey,
  kind,
  posterKey,
  ratio = 3 / 4,
  gallery,
  index = 0,
  title,
  className,
  children,
}: {
  mediaKey: string | null | undefined;
  kind?: string;
  posterKey?: string | null;
  ratio?: number;
  gallery?: ViewerMedia[];
  index?: number;
  title?: string;
  className?: string;
  children?: ReactNode;
}) {
  const url = useMediaUrl();
  const [open, setOpen] = useState(false);
  const video = !!mediaKey && isVideo({ key: mediaKey, kind });
  return (
    <AspectRatio
      ratio={ratio}
      className={cn("group/media relative overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10", className)}
    >
      {!mediaKey ? (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImageOffIcon className="size-5" />
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="block size-full cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            aria-label="Open larger"
          >
            <img
              src={url(video ? posterKey : mediaKey)}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-full object-cover transition-transform duration-300 ease-out group-hover/media:scale-[1.03] motion-reduce:transition-none"
            />
          </button>
          <PhotoViewer
            items={gallery ?? [{ key: mediaKey, kind, posterKey }]}
            index={gallery ? index : 0}
            open={open}
            onOpenChange={setOpen}
            title={title}
          />
        </>
      )}
      {children}
    </AspectRatio>
  );
}

/** A badge laid over a photo, readable on any picture. */
export function OverlayBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "danger";
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "pointer-events-none absolute top-2 left-2 border-transparent bg-background/85 capitalize backdrop-blur-sm",
        tone === "danger" && "text-destructive",
        className,
      )}
    >
      {children}
    </Badge>
  );
}

/** Label/value rows for facts about an account. */
export function Facts({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(7.5rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([label, value], i) => (
        <div key={i} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">{value ?? <span className="text-muted-foreground">None</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Id({ value }: { value: string }) {
  return <span className="font-mono text-xs text-muted-foreground">{value}</span>;
}

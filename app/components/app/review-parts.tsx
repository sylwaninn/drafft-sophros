// What the photo and flag queues show around each item: the media, large, and the account behind it.
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowUpRightIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { Person } from "~/lib/types";
import { Facts, HoldBadge, MediaTile, Panel, PersonLink, TimeAgo } from "./bits";
import { isVideo, PhotoViewer } from "./photo-viewer";
import { useMediaUrl } from "./root-data";

export interface AccountBrief {
  createdAt: string;
  lastActiveAt: string;
  age: number | null;
  gender: string | null;
  onboarded: boolean;
  flags30d: number;
  reports30d: number;
  holds: number;
  photos: { key: string; status: string }[];
}

/** The item under review, as large as the screen allows; a click opens it full size. */
export function ReviewStage({ mediaKey, kind, posterKey, caption, children }: { mediaKey: string; kind?: string; posterKey?: string | null; caption: string; children?: ReactNode }) {
  const url = useMediaUrl();
  const [open, setOpen] = useState(false);
  const video = isVideo({ key: mediaKey, kind });
  return (
    <div className="relative flex h-[min(62vh,44rem)] items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
      {video ? (
        <video key={mediaKey} src={url(mediaKey)} poster={url(posterKey)} controls className="max-h-full max-w-full" />
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="flex size-full cursor-zoom-in items-center justify-center" aria-label="Open full size">
          <img src={url(mediaKey)} alt={caption} referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
        </button>
      )}
      {children}
      <PhotoViewer items={[{ key: mediaKey, kind, posterKey, caption }]} index={0} open={open} onOpenChange={setOpen} title="Full size" />
    </div>
  );
}

/** The account behind the item: who, how old the account is, its history, and its other photos. */
export function AccountPanel({ person, brief, highlight }: { person: Person | null; brief: AccountBrief | null; highlight?: string }) {
  if (!person) return null;
  const others = brief?.photos ?? [];
  return (
    <Panel
      title={<PersonLink person={person} showHold={false} />}
      action={
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to={`/accounts/${person.id}`} aria-label="Open the account">
            <ArrowUpRightIcon />
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        {person.moderation && <HoldBadge hold={person.moderation} />}
        {brief && (
          <Facts
            rows={[
              ["Person", [brief.age !== null ? `${brief.age}` : null, brief.gender].filter(Boolean).join(", ") || null],
              ["Account", <TimeAgo key="c" value={brief.createdAt} />],
              ["Last active", <TimeAgo key="a" value={brief.lastActiveAt} />],
              [
                "Flags, 30 days",
                <Badge key="f" variant={brief.flags30d > 1 ? "destructive" : "secondary"}>
                  {brief.flags30d}
                </Badge>,
              ],
              [
                "Reporters, 30 days",
                <Badge key="r" variant={brief.reports30d > 0 ? "destructive" : "secondary"}>
                  {brief.reports30d}
                </Badge>,
              ],
              ["Holds before", String(brief.holds)],
            ]}
          />
        )}
        {others.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Their photos</div>
            <div className="grid grid-cols-4 gap-2">
              {others.map((p, i) => (
                <MediaTile
                  key={p.key}
                  mediaKey={p.key}
                  gallery={others.map((o, j) => ({ key: o.key, caption: `Photo ${j + 1} of ${others.length}, ${o.status}` }))}
                  index={i}
                  title={`${person.name || "Their"} photos`}
                  className={p.key === highlight ? "ring-2 ring-primary" : undefined}
                >
                  {p.status !== "approved" && <span className="absolute inset-x-0 bottom-0 bg-background/85 py-0.5 text-center text-[10px] capitalize">{p.status}</span>}
                </MediaTile>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

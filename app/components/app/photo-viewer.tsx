// Photos open large in a dialog, never in a new tab. Several photos: ← and → move between them.
import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Kbd } from "~/components/ui/kbd";
import { useMediaUrl } from "./root-data";

export interface ViewerMedia {
  key: string;
  /** A ready URL (a signed selfie link) instead of the media bucket's. */
  src?: string;
  kind?: string;
  posterKey?: string | null;
  caption?: string;
}

export const isVideo = (m: { key: string; kind?: string }) => m.kind === "video" || /\.(mp4|mov|m4v)$/i.test(m.key);

/**
 * ← and → call these, unless someone is typing. A page's own arrows stand aside while a dialog is open;
 * the dialog's (`inDialog`) take over.
 */
export function useArrowKeys(onPrev: () => void, onNext: () => void, enabled = true, inDialog = false) {
  useEffect(() => {
    if (!enabled) return;
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable=true], [data-slot=tabs-list]") ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      const dialogOpen = !!document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]');
      if (dialogOpen !== inDialog) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [onPrev, onNext, enabled, inDialog]);
}

export function PhotoViewer({
  items,
  index,
  open,
  onOpenChange,
  title = "Photo",
}: {
  items: ViewerMedia[];
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}) {
  if (!items.length) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 p-3 sm:max-w-3xl">
        {/* Mounted while open: each opening starts on the photo clicked. */}
        <ViewerBody items={items} index={index} title={title} />
      </DialogContent>
    </Dialog>
  );
}

function ViewerBody({ items, index, title }: { items: ViewerMedia[]; index: number; title: string }) {
  const url = useMediaUrl();
  const [at, setAt] = useState(index);
  const many = items.length > 1;
  const prev = () => setAt((i) => (i - 1 + items.length) % items.length);
  const next = () => setAt((i) => (i + 1) % items.length);
  useArrowKeys(prev, next, many, true);
  const current = items[at] ?? items[0];

  return (
    <>
      <DialogHeader className="px-1 pt-1">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{current.caption ?? (many ? `Photo ${at + 1} of ${items.length}` : "Full size")}</DialogDescription>
      </DialogHeader>
      <div className="relative flex h-[min(75vh,52rem)] items-center justify-center overflow-hidden rounded-[calc(var(--radius-xl)-0.75rem)] bg-muted">
        {isVideo(current) ? (
          <video
            key={current.key}
            src={url(current.key)}
            poster={url(current.posterKey)}
            controls
            autoPlay
            className="max-h-full max-w-full"
          />
        ) : (
          <img
            key={current.key}
            src={current.src ?? url(current.key)}
            alt={current.caption ?? ""}
            referrerPolicy="no-referrer"
            className="max-h-full max-w-full animate-in object-contain duration-200 fade-in-0 zoom-in-[0.98]"
          />
        )}
        {many && (
          <>
            <Button variant="secondary" size="icon" className="absolute left-3 rounded-full" onClick={prev} aria-label="Previous photo">
              <ChevronLeftIcon />
            </Button>
            <Button variant="secondary" size="icon" className="absolute right-3 rounded-full" onClick={next} aria-label="Next photo">
              <ChevronRightIcon />
            </Button>
          </>
        )}
      </div>
      {many && (
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {at + 1} / {items.length}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
            to move between photos, <Kbd>Esc</Kbd> to close
          </span>
        </div>
      )}
    </>
  );
}

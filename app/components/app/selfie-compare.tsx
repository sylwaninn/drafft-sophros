// The selfie check, one case at a time: the selfie on the left, the profile's photos on the right, one
// at a time at the same size. ← and → go through the photos; the three decisions sit underneath.
import { useCallback, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, ShieldBanIcon, UserRoundCheckIcon } from "lucide-react";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Kbd } from "~/components/ui/kbd";
import { cn } from "~/lib/utils";
import { suggestedCategory } from "~/lib/reasons";
import type { Person } from "~/lib/types";
import { ActButton, ReasonDialog } from "./act";
import { OverlayBadge, PersonLink, TimeAgo } from "./bits";
import { PhotoViewer, useArrowKeys } from "./photo-viewer";
import { useMediaUrl } from "./root-data";

export interface SelfieCaseData {
  person: Person;
  selfieAt: string;
  cause: string;
  photos: { key: string; status: string }[];
}

const ease = [0.16, 1, 0.3, 1] as const;

export function SelfieCompare({
  item,
  selfie,
  position,
  total,
  canDecide,
}: {
  item: SelfieCaseData;
  selfie: string | null;
  position: number;
  total: number;
  canDecide: boolean;
}) {
  const url = useMediaUrl();
  const [at, setAt] = useState(0);
  const [direction, setDirection] = useState(1);
  const [viewer, setViewer] = useState<"selfie" | "photo" | null>(null);
  const photos = item.photos;
  const count = photos.length;
  const prev = useCallback(() => {
    setDirection(-1);
    setAt((i) => (i - 1 + count) % count);
  }, [count]);
  const next = useCallback(() => {
    setDirection(1);
    setAt((i) => (i + 1) % count);
  }, [count]);
  useArrowKeys(prev, next, count > 1);
  const photo = photos[at];
  const name = item.person.name || "this account";

  return (
    <MotionConfig reducedMotion="user">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <PersonLink person={item.person} showHold={false} />
          </CardTitle>
          <CardDescription>
            {item.cause}. Selfie sent <TimeAgo value={item.selfieAt} />.
          </CardDescription>
          <CardAction>
            <Badge variant="secondary" className="tabular-nums">
              Case {position} of {total}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 lg:gap-6">
            <figure className="space-y-2">
              <figcaption className="text-sm font-medium">Selfie</figcaption>
              <AspectRatio ratio={3 / 4} className="overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
                {selfie ? (
                  <button
                    type="button"
                    onClick={() => setViewer("selfie")}
                    className="block size-full cursor-zoom-in"
                    aria-label="Open the selfie larger"
                  >
                    <img
                      src={selfie}
                      alt={`Verification selfie of ${name}`}
                      referrerPolicy="no-referrer"
                      className="size-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="flex size-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                    {canDecide ? "The selfie file is missing." : "Selfies are shown to moderators."}
                  </div>
                )}
                <OverlayBadge>Front camera</OverlayBadge>
              </AspectRatio>
            </figure>
            <figure className="space-y-2">
              <figcaption className="flex items-center justify-between text-sm font-medium">
                <span>Profile photo</span>
                <span className="text-muted-foreground tabular-nums">{count ? `${at + 1} of ${count}` : "None"}</span>
              </figcaption>
              <AspectRatio ratio={3 / 4} className="overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                  {photo && (
                    <motion.button
                      key={photo.key}
                      type="button"
                      custom={direction}
                      initial={{ opacity: 0, x: direction * 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction * -24 }}
                      transition={{ duration: 0.22, ease }}
                      onClick={() => setViewer("photo")}
                      className="absolute inset-0 block cursor-zoom-in"
                      aria-label="Open this photo larger"
                    >
                      <img
                        src={url(photo.key)}
                        alt={`${name}, profile ${at + 1} of ${count}`}
                        referrerPolicy="no-referrer"
                        className="size-full object-cover"
                      />
                    </motion.button>
                  )}
                </AnimatePresence>
                {photo && photo.status !== "approved" && <OverlayBadge>{photo.status}</OverlayBadge>}
                {count > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full shadow-sm"
                      onClick={prev}
                      aria-label="Previous photo"
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full shadow-sm"
                      onClick={next}
                      aria-label="Next photo"
                    >
                      <ChevronRightIcon />
                    </Button>
                  </>
                )}
              </AspectRatio>
              {count > 1 && (
                <div className="flex gap-2" role="tablist" aria-label="Profile photos">
                  {photos.map((p, i) => (
                    <button
                      key={p.key}
                      type="button"
                      role="tab"
                      aria-selected={i === at}
                      aria-label={`Photo ${i + 1}`}
                      onClick={() => {
                        setDirection(i > at ? 1 : -1);
                        setAt(i);
                      }}
                      className={cn(
                        "relative aspect-[3/4] w-12 overflow-hidden rounded-md bg-muted ring-1 ring-foreground/10 transition-[opacity,box-shadow] duration-150",
                        i === at ? "ring-2 ring-primary" : "opacity-50 hover:opacity-100",
                      )}
                    >
                      <img src={url(p.key)} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </figure>
          </div>
          {count > 1 && (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Kbd>←</Kbd>
              <Kbd>→</Kbd>
              to compare the selfie with each photo. Click a photo to open it larger.
            </p>
          )}
        </CardContent>
        {canDecide && (
          <CardFooter className="flex flex-wrap justify-end gap-2 border-t">
            <ReasonDialog
              intent="hold"
              fields={{ user: item.person.id, state: "banned" }}
              destructive
              statement={{}}
              title={`Ban ${name}?`}
              description="The selfie isn't the person in the photos. Their email, phone and sign-ins can't come back."
              submit="Ban"
              trigger={
                <Button variant="destructive">
                  <ShieldBanIcon data-icon="inline-start" />
                  Not them: ban
                </Button>
              }
            />
            <ReasonDialog
              intent="hold"
              fields={{ user: item.person.id, state: "selfie" }}
              statement={{ category: suggestedCategory("selfie") }}
              title="Ask for another selfie"
              description="Their account stays frozen until they send a new one."
              placeholder="Blurry, face hidden, not the front camera"
              submit="Ask again"
              trigger={
                <Button variant="outline">
                  <CameraIcon data-icon="inline-start" />
                  Ask again
                </Button>
              }
            />
            <ActButton intent="hold" fields={{ user: item.person.id, state: "", reason: "selfie matches the photos" }}>
              <UserRoundCheckIcon data-icon="inline-start" />
              Same person: lift the hold
            </ActButton>
          </CardFooter>
        )}
      </Card>
      {selfie && (
        <PhotoViewer
          items={[{ key: "selfie", src: selfie, caption: `Selfie of ${name}` }]}
          index={0}
          open={viewer === "selfie"}
          onOpenChange={(open) => !open && setViewer(null)}
          title="Selfie"
        />
      )}
      <PhotoViewer
        items={photos.map((p, i) => ({ key: p.key, caption: `Profile photo ${i + 1} of ${count}` }))}
        index={at}
        open={viewer === "photo"}
        onOpenChange={(open) => !open && setViewer(null)}
        title={`${name}'s photos`}
      />
    </MotionConfig>
  );
}

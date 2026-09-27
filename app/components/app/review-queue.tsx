// A review queue: one item at a time, large, with everything needed to decide next to it. A decision
// applies at once (keyboard letter or button); the item leaves and the next one slides in.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { type LucideIcon, ChevronLeftIcon, ChevronRightIcon, CircleCheckIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import type { BatchOp } from "~/routes/act";
import { useAct } from "./act";

export interface ReviewAction<T> {
  id: string;
  /** The keyboard shortcut, one lowercase letter. */
  key: string;
  label: string;
  icon: LucideIcon;
  variant?: "default" | "outline" | "secondary" | "destructive";
  available?: (item: T) => boolean;
  /** Asked first (a ban): the reason is required and goes to the audit log. */
  prompt?: { title: (item: T) => string; description: string; destructive?: boolean; placeholder?: string };
  /** The reason written for the reviewer when none is asked. */
  reason?: (item: T) => string;
  /** What the toast says once it's done. */
  done: string;
  ops: (item: T, reason: string) => BatchOp[];
}

const ease = [0.16, 1, 0.3, 1] as const;

export function ReviewQueue<T>({
  items,
  getId,
  title,
  itemNoun,
  stage,
  aside,
  actions,
  extra,
  empty,
}: {
  items: T[];
  getId: (item: T) => string;
  title: (item: T) => ReactNode;
  itemNoun: string;
  stage: (item: T) => ReactNode;
  aside: (item: T) => ReactNode;
  actions: ReviewAction<T>[];
  /** Other buttons for the item (links), after the decisions. */
  extra?: (item: T) => ReactNode;
  empty: { title: string; description: string };
}) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [prompting, setPrompting] = useState<ReviewAction<T> | null>(null);
  const { fetcher, pending } = useAct();

  // The item decided on leaves the list: the same position now holds the next one.
  const at = Math.min(index, Math.max(items.length - 1, 0));
  const current = items[at];

  const go = useCallback(
    (to: number) => {
      if (!items.length) return;
      setDirection(to >= at ? 1 : -1);
      setIndex((to + items.length) % items.length);
    },
    [items.length, at],
  );

  const run = useCallback(
    (action: ReviewAction<T>, item: T, reason: string) => {
      setDirection(1);
      fetcher.submit(
        { intent: "batch", message: action.done, ops: JSON.stringify(action.ops(item, reason)) },
        { method: "post", action: "/act" },
      );
    },
    [fetcher],
  );

  const decide = useCallback(
    (action: ReviewAction<T>) => {
      if (!current || pending || (action.available && !action.available(current))) return;
      if (action.prompt) setPrompting(action);
      else run(action, current, action.reason?.(current) ?? "");
    },
    [current, pending, run],
  );

  // Keyboard: ← → move, a letter decides.
  const handlers = useRef({ go, decide, at, actions, current });
  handlers.current = { go, decide, at, actions, current };
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const h = handlers.current;
      if (event.key === "ArrowLeft") return (event.preventDefault(), h.go(h.at - 1));
      if (event.key === "ArrowRight") return (event.preventDefault(), h.go(h.at + 1));
      const key = event.key.toLowerCase();
      const action = h.actions.find((a) => a.key === key && (!a.available || (h.current && a.available(h.current))));
      if (action) {
        event.preventDefault();
        h.decide(action);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  if (!current) {
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleCheckIcon />
          </EmptyMedia>
          <EmptyTitle>{empty.title}</EmptyTitle>
          <EmptyDescription>{empty.description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const shown = actions.filter((a) => !a.available || a.available(current));

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>{title(current)}</CardTitle>
              <CardAction>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {itemNoun} {at + 1} of {items.length}
                  </span>
                  <Button variant="ghost" size="icon-sm" onClick={() => go(at - 1)} disabled={items.length < 2} aria-label="Previous">
                    <ChevronLeftIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => go(at + 1)} disabled={items.length < 2} aria-label="Next">
                    <ChevronRightIcon />
                  </Button>
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                <motion.div
                  key={getId(current)}
                  initial={{ opacity: 0, x: direction * 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -32, filter: "blur(4px)" }}
                  transition={{ duration: 0.24, ease }}
                >
                  {stage(current)}
                </motion.div>
              </AnimatePresence>
            </CardContent>
            <CardFooter className="flex flex-wrap items-center gap-2 border-t">
              {shown.map((a) => (
                <Button key={a.id} variant={a.variant ?? "outline"} disabled={pending} onClick={() => decide(a)}>
                  {pending && fetcher.formData?.get("message") === a.done ? <Spinner data-icon="inline-start" /> : <a.icon data-icon="inline-start" />}
                  {a.label}
                  <Kbd className="ml-1">{a.key.toUpperCase()}</Kbd>
                </Button>
              ))}
              {extra?.(current)}
            </CardFooter>
          </Card>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <KbdGroup>
                <Kbd>←</Kbd>
                <Kbd>→</Kbd>
              </KbdGroup>
              move without deciding
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>{shown.map((a) => a.key.toUpperCase()).join(" ")}</Kbd>
              decide: it applies at once, then the next one comes
            </span>
          </p>
        </div>
        <div className="space-y-6">{aside(current)}</div>
      </div>

      {prompting && (
        <ReasonPrompt
          action={prompting}
          item={current}
          onCancel={() => setPrompting(null)}
          onConfirm={(reason) => {
            run(prompting, current, reason);
            setPrompting(null);
          }}
        />
      )}
    </MotionConfig>
  );
}

/** The reason a decision needs first (a ban). */
function ReasonPrompt<T>({ action, item, onCancel, onConfirm }: { action: ReviewAction<T>; item: T; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const prompt = action.prompt!;
  const submit = () => reason.trim() && onConfirm(reason.trim());
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{prompt.title(item)}</DialogTitle>
          <DialogDescription>{prompt.description}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Field>
            <FieldLabel htmlFor="decision-reason">Reason</FieldLabel>
            <Textarea
              id="decision-reason"
              autoFocus
              required
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={prompt.placeholder ?? "What you saw, for the audit log"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <FieldDescription>Saved with your email in the audit log.</FieldDescription>
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant={prompt.destructive ? "destructive" : "default"} disabled={!reason.trim()}>
              {action.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

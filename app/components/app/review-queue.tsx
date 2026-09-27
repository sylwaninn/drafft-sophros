// A review queue: one item at a time, big, with everything needed to decide next to it. Decisions are
// only staged: they pile up in a batch the reviewer can undo (Z, or any row), and nothing reaches the
// database until "Apply". Leaving the page with staged decisions asks first.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useBlocker } from "react-router";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { type LucideIcon, ChevronLeftIcon, ChevronRightIcon, CircleCheckIcon, Undo2Icon, XIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "~/components/ui/item";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
import { Progress } from "~/components/ui/progress";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import type { BatchOp } from "~/routes/act";
import { useAct } from "./act";
import { useMediaUrl } from "./root-data";

export type DecisionTone = "approve" | "reject" | "hold" | "neutral";

export interface ReviewAction<T> {
  id: string;
  /** The keyboard shortcut, one lowercase letter. */
  key: string;
  label: string;
  icon: LucideIcon;
  tone: DecisionTone;
  variant?: "default" | "outline" | "secondary" | "destructive";
  available?: (item: T) => boolean;
  /** Asked before staging (a ban): the reason is required and goes to the audit log. */
  prompt?: { title: (item: T) => string; description: string; destructive?: boolean; placeholder?: string };
  /** A reason written for the reviewer when none is asked. */
  reason?: (item: T) => string;
  ops: (item: T, reason: string) => BatchOp[];
}

interface Decision {
  action: string;
  label: string;
  tone: DecisionTone;
  ops: BatchOp[];
}

const toneBadge: Record<DecisionTone, string> = {
  approve: "bg-cleared/15 text-cleared",
  reject: "bg-banned/15 text-banned",
  hold: "bg-review/15 text-review",
  neutral: "bg-secondary text-secondary-foreground",
};

const ease = [0.16, 1, 0.3, 1] as const;

/** Holds are applied last, one per account (the last one staged), after the photo decisions. */
function flatten(decisions: Decision[]): BatchOp[] {
  const ops = decisions.flatMap((d) => d.ops);
  const lastHold = new Map<string, BatchOp>();
  for (const op of ops) if (op.intent === "hold") lastHold.set(op.user, op);
  return [...ops.filter((op) => op.intent !== "hold"), ...lastHold.values()];
}

export function ReviewQueue<T>({
  items,
  getId,
  thumb,
  title,
  itemNoun,
  stage,
  aside,
  actions,
  empty,
}: {
  items: T[];
  getId: (item: T) => string;
  thumb: (item: T) => string | null | undefined;
  title: (item: T) => string;
  itemNoun: string;
  stage: (item: T) => ReactNode;
  aside: (item: T) => ReactNode;
  actions: ReviewAction<T>[];
  empty: { title: string; description: string };
}) {
  const url = useMediaUrl();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());
  const [order, setOrder] = useState<string[]>([]);
  const [prompting, setPrompting] = useState<ReviewAction<T> | null>(null);
  const { fetcher, pending: applying } = useAct({
    onDone: () => {
      setDecisions(new Map());
      setOrder([]);
      setIndex(0);
    },
  });

  // Items that left (applied, or handled elsewhere) take their staged decisions with them.
  const ids = useMemo(() => new Set(items.map(getId)), [items, getId]);
  const staged = order.filter((id) => ids.has(id) && decisions.has(id));
  const current = items[Math.min(index, items.length - 1)];
  const currentId = current ? getId(current) : null;
  const decided = currentId ? decisions.get(currentId) : undefined;
  const allDecided = items.length > 0 && items.every((i) => decisions.has(getId(i)));

  const go = useCallback(
    (to: number) => {
      if (!items.length) return;
      const next = (to + items.length) % items.length;
      setDirection(next >= index ? 1 : -1);
      setIndex(next);
    },
    [items.length, index],
  );

  const stage_ = useCallback(
    (action: ReviewAction<T>, item: T, reason: string) => {
      const id = getId(item);
      setDecisions((d) => new Map(d).set(id, { action: action.id, label: action.label, tone: action.tone, ops: action.ops(item, reason) }));
      setOrder((o) => [...o.filter((x) => x !== id), id]);
      // On to the next item without a decision.
      const at = items.indexOf(item);
      for (let step = 1; step <= items.length; step++) {
        const candidate = items[(at + step) % items.length];
        if (!decisions.has(getId(candidate)) && getId(candidate) !== id) {
          setDirection(1);
          setIndex((at + step) % items.length);
          return;
        }
      }
    },
    [items, getId, decisions],
  );

  const decide = useCallback(
    (action: ReviewAction<T>) => {
      if (!current || (action.available && !action.available(current))) return;
      if (action.prompt) setPrompting(action);
      else stage_(action, current, action.reason?.(current) ?? "");
    },
    [current, stage_],
  );

  const undo = useCallback(
    (id?: string) => {
      const target = id ?? staged.at(-1);
      if (!target) return;
      setDecisions((d) => {
        const next = new Map(d);
        next.delete(target);
        return next;
      });
      setOrder((o) => o.filter((x) => x !== target));
      const at = items.findIndex((i) => getId(i) === target);
      if (at >= 0) {
        setDirection(at >= index ? 1 : -1);
        setIndex(at);
      }
    },
    [staged, items, getId, index],
  );

  const apply = useCallback(() => {
    const ops = flatten(staged.map((id) => decisions.get(id)!));
    if (!ops.length || applying) return;
    fetcher.submit({ intent: "batch", ops: JSON.stringify(ops) }, { method: "post", action: "/act" });
  }, [staged, decisions, applying, fetcher]);

  // Keyboard: ← → move, a letter decides, Z undoes, ⌘↵ applies.
  const handlers = useRef({ go, decide, undo, apply, index, actions });
  handlers.current = { go, decide, undo, apply, index, actions };
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      const h = handlers.current;
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        h.apply();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowLeft") return (event.preventDefault(), h.go(h.index - 1));
      if (event.key === "ArrowRight") return (event.preventDefault(), h.go(h.index + 1));
      const key = event.key.toLowerCase();
      if (key === "z") return (event.preventDefault(), h.undo());
      const action = h.actions.find((a) => a.key === key);
      if (action) {
        event.preventDefault();
        h.decide(action);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  // Staged decisions aren't lost by accident.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => staged.length > 0 && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!staged.length) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [staged.length]);

  if (!items.length) {
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

  const position = Math.min(index, items.length - 1) + 1;
  const done = items.filter((i) => decisions.has(getId(i))).length;

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium whitespace-nowrap tabular-nums">
              {itemNoun} {position} of {items.length}
            </span>
            <Progress value={(done / items.length) * 100} className="h-1.5" aria-label={`${done} of ${items.length} decided`} />
            <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">{done} decided</span>
          </div>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle>{current && title(current)}</CardTitle>
              <CardAction>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => go(index - 1)} aria-label="Previous">
                    <ChevronLeftIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => go(index + 1)} aria-label="Next">
                    <ChevronRightIcon />
                  </Button>
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                  {current && (
                    <motion.div
                      key={currentId}
                      initial={{ opacity: 0, x: direction * 32 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction * -32 }}
                      transition={{ duration: 0.24, ease }}
                    >
                      {stage(current)}
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {decided && (
                    <motion.div
                      key={decided.action}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.18, ease }}
                      className="absolute top-3 right-3 z-10 flex items-center gap-2"
                    >
                      <Badge className={cn("h-7 px-3 text-sm backdrop-blur", toneBadge[decided.tone])}>{decided.label}, not applied yet</Badge>
                      <Button size="sm" variant="secondary" onClick={() => undo(currentId!)}>
                        <Undo2Icon data-icon="inline-start" />
                        Undo
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2 border-t">
              {actions.map((a) => {
                const off = !current || (a.available ? !a.available(current) : false);
                return (
                  <Button key={a.id} variant={decided?.action === a.id ? "default" : (a.variant ?? "outline")} disabled={off} onClick={() => decide(a)}>
                    <a.icon data-icon="inline-start" />
                    {a.label}
                    <Kbd className="ml-1">{a.key.toUpperCase()}</Kbd>
                  </Button>
                );
              })}
            </CardFooter>
          </Card>

          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <KbdGroup>
                <Kbd>←</Kbd>
                <Kbd>→</Kbd>
              </KbdGroup>
              move
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>{actions.map((a) => a.key.toUpperCase()).join(" ")}</Kbd>
              decide, then on to the next
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>Z</Kbd>
              undo the last decision
            </span>
            <span className="inline-flex items-center gap-1.5">
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>↵</Kbd>
              </KbdGroup>
              apply the batch
            </span>
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Batch</CardTitle>
              <CardDescription>
                {staged.length ? "Staged, not applied yet. Undo any of them before applying." : `Decide on a ${itemNoun.toLowerCase()} to stage it here.`}
              </CardDescription>
              <CardAction>
                <Badge variant={staged.length ? "default" : "secondary"} className="tabular-nums">
                  {staged.length}
                </Badge>
              </CardAction>
            </CardHeader>
            {staged.length > 0 && (
              <CardContent className="px-0">
                <ScrollArea className="max-h-72 px-6">
                  <ItemGroup className="gap-1">
                    <AnimatePresence initial={false}>
                      {[...staged].reverse().map((id) => {
                        const d = decisions.get(id)!;
                        const item = items.find((i) => getId(i) === id)!;
                        return (
                          <motion.div
                            key={id}
                            layout="position"
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: 16 }}
                            transition={{ duration: 0.2, ease }}
                          >
                            <Item size="sm" className="px-0">
                              <ItemMedia variant="image">
                                <img src={url(thumb(item))} alt="" referrerPolicy="no-referrer" />
                              </ItemMedia>
                              <ItemContent>
                                <ItemTitle>
                                  <button type="button" className="truncate hover:underline" onClick={() => go(items.indexOf(item))}>
                                    {title(item)}
                                  </button>
                                </ItemTitle>
                                <ItemDescription>
                                  <Badge className={cn("h-5", toneBadge[d.tone])}>{d.label}</Badge>
                                </ItemDescription>
                              </ItemContent>
                              <ItemActions>
                                <Button variant="ghost" size="icon-xs" onClick={() => undo(id)} aria-label={`Undo ${d.label}`}>
                                  <XIcon />
                                </Button>
                              </ItemActions>
                            </Item>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </ItemGroup>
                </ScrollArea>
              </CardContent>
            )}
            <CardFooter className="flex gap-2">
              <Button className="flex-1" disabled={!staged.length || applying} onClick={apply}>
                {applying && <Spinner data-icon="inline-start" />}
                Apply {staged.length || ""}
                <KbdGroup className="ml-1">
                  <Kbd>⌘</Kbd>
                  <Kbd>↵</Kbd>
                </KbdGroup>
              </Button>
              <Button variant="outline" disabled={!staged.length || applying} onClick={() => undo()}>
                <Undo2Icon data-icon="inline-start" />
                Undo
              </Button>
            </CardFooter>
          </Card>
          {allDecided && (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>Every {itemNoun.toLowerCase()} has a decision</EmptyTitle>
                <EmptyDescription>Check the batch, then apply it.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={apply} disabled={applying}>
                  Apply {staged.length}
                </Button>
              </EmptyContent>
            </Empty>
          )}
          {current && aside(current)}
        </div>
      </div>

      {prompting && current && (
        <ReasonPrompt
          action={prompting}
          item={current}
          onCancel={() => setPrompting(null)}
          onConfirm={(reason) => {
            stage_(prompting, current, reason);
            setPrompting(null);
          }}
        />
      )}

      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without applying?</AlertDialogTitle>
            <AlertDialogDescription>
              {staged.length} staged decision{staged.length === 1 ? " is" : "s are"} not applied yet and will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Stay</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => blocker.proceed?.()}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MotionConfig>
  );
}

/** The reason a decision needs before it's staged (a ban). */
function ReasonPrompt<T>({
  action,
  item,
  onCancel,
  onConfirm,
}: {
  action: ReviewAction<T>;
  item: T;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const prompt = action.prompt!;
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{prompt.title(item)}</DialogTitle>
          <DialogDescription>{prompt.description} It's staged in the batch; nothing happens before you apply it.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (reason.trim()) onConfirm(reason.trim());
          }}
        >
          <Field>
            <FieldLabel htmlFor="stage-reason">Reason</FieldLabel>
            <Textarea
              id="stage-reason"
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
                  if (reason.trim()) onConfirm(reason.trim());
                }
              }}
            />
            <FieldDescription>Saved with your email in the audit log when the batch is applied.</FieldDescription>
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant={prompt.destructive ? "destructive" : "default"} disabled={!reason.trim()}>
              Stage: {action.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

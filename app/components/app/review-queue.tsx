// A review queue: one item at a time, large, with everything needed to decide next to it. A decision
// applies at once (keyboard letter or button), or asks first when it needs a reason (a ban) or tells the
// member why (a refused photo, a hold); the item leaves and the next one slides in.
import { useCallback, useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { type LucideIcon, ChevronLeftIcon, ChevronRightIcon, CircleCheckIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import type { Statement } from "~/lib/reasons";
import type { Decision } from "~/routes/act";
import { useAct } from "./act";
import { StatementFields, statementReady } from "./statement-fields";
import { typingIn, useLetterShortcuts } from "./shortcuts";

export interface ReviewAction<T> {
  id: string;
  /** The keyboard shortcut, one lowercase letter. */
  key: string;
  label: string;
  icon: LucideIcon;
  variant?: "default" | "outline" | "secondary" | "destructive";
  available?: (item: T) => boolean;
  /** Asked first (a ban, or anything the member is told): the reason is required and goes to the audit log. */
  prompt?: { title: (item: T) => string; description: string; destructive?: boolean; placeholder?: string };
  /**
   * The member is told this decision and why: the prompt also asks for the reason category they're told
   * (preselected with `category`) and a note for them. Needs `prompt`.
   */
  statement?: { category?: string };
  /** The reason written for the reviewer when none is asked; the prompt starts from it when one is. */
  reason?: (item: T) => string;
  /** What the toast says once it's done. */
  done: string;
  /** The decision, applied whole in one database transaction. */
  decide: (item: T, answer: Answer) => Decision;
}

/** What a decision was given: the internal reason, and what the member is told when they are. */
export type Answer = { reason: string } & Statement;

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
    (action: ReviewAction<T>, item: T, answer: Answer) => {
      setDirection(1);
      // Reloaded even when refused: the item may have been decided on by someone else meanwhile.
      fetcher.submit(
        { intent: "decide", message: action.done, decision: JSON.stringify(action.decide(item, answer)) },
        { method: "post", action: "/act", defaultShouldRevalidate: true },
      );
    },
    [fetcher],
  );

  const decide = useCallback(
    (action: ReviewAction<T>) => {
      if (!current || pending || (action.available && !action.available(current))) return;
      if (action.prompt) setPrompting(action);
      else run(action, current, { reason: action.reason?.(current) ?? "" });
    },
    [current, pending, run],
  );

  // Keyboard: ← → move, a letter decides (unless letters are off). Never while typing in a field or
  // with a dialog or menu open.
  const [letters, setLetters] = useLetterShortcuts();
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (typingIn(event.target)) return;
    if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "ArrowLeft") return (event.preventDefault(), go(at - 1));
    if (event.key === "ArrowRight") return (event.preventDefault(), go(at + 1));
    if (!letters || event.repeat) return;
    const key = event.key.toLowerCase();
    const action = actions.find((a) => a.key === key && (!a.available || (current && a.available(current))));
    if (action) {
      event.preventDefault();
      decide(action);
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
                  {pending && fetcher.formData?.get("message") === a.done ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <a.icon data-icon="inline-start" />
                  )}
                  {a.label}
                  {letters && <Kbd className="ml-1">{a.key.toUpperCase()}</Kbd>}
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
              <Checkbox id="letter-shortcuts" checked={letters} onCheckedChange={(v) => setLetters(v === true)} />
              <Label htmlFor="letter-shortcuts" className="font-normal text-muted-foreground">
                Letters decide
              </Label>
              {letters && (
                <>
                  <Kbd>{shown.map((a) => a.key.toUpperCase()).join(" ")}</Kbd>
                  it applies at once, or asks first when they're told why, then the next one comes
                </>
              )}
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
          onConfirm={(answer) => {
            run(prompting, current, answer);
            setPrompting(null);
          }}
        />
      )}
    </MotionConfig>
  );
}

/** What a decision needs first: a reason (a ban), and what the member is told when they are. */
function ReasonPrompt<T>({
  action,
  item,
  onCancel,
  onConfirm,
}: {
  action: ReviewAction<T>;
  item: T;
  onCancel: () => void;
  onConfirm: (answer: Answer) => void;
}) {
  const [reason, setReason] = useState(() => action.reason?.(item) ?? "");
  const [told, setTold] = useState<Statement>({ category: action.statement?.category });
  const prompt = action.prompt!;
  const ready = Boolean(reason.trim()) && (!action.statement || statementReady(told));
  const submit = () => {
    if (!ready) return;
    const details = told.details?.trim();
    onConfirm(
      action.statement ? { reason: reason.trim(), category: told.category, details: details || undefined } : { reason: reason.trim() },
    );
  };
  const form = (
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <FieldGroup>
        {action.statement && <StatementFields id="decision" value={told} onChange={setTold} />}
        <Field>
          <FieldLabel htmlFor="decision-reason">{action.statement ? "Internal reason" : "Reason"}</FieldLabel>
          <Textarea
            id="decision-reason"
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
          <FieldDescription>
            {action.statement ? "Not sent to them: saved with your email in the audit log." : "Saved with your email in the audit log."}
          </FieldDescription>
        </Field>
      </FieldGroup>
      {prompt.destructive ? (
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
          <Button type="submit" variant="destructive" disabled={!ready}>
            {action.label}
          </Button>
        </AlertDialogFooter>
      ) : (
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={!ready}>
            {action.label}
          </Button>
        </DialogFooter>
      )}
    </form>
  );
  // A ban is asked in an alert dialog, like every ban in sophros.
  if (prompt.destructive) {
    return (
      <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{prompt.title(item)}</AlertDialogTitle>
            <AlertDialogDescription>{prompt.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {form}
        </AlertDialogContent>
      </AlertDialog>
    );
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{prompt.title(item)}</DialogTitle>
          <DialogDescription>{prompt.description}</DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}

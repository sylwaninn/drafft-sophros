// Every change posts to /act through a fetcher; the result comes back as a toast, and React Router
// reloads what's on screen (resolved items then leave their queue).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { ChevronDownIcon, ScanFaceIcon, ShieldBanIcon, ShieldCheckIcon, ShieldIcon, ShieldQuestionIcon } from "lucide-react";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { can } from "~/lib/roles";
import type { Hold } from "~/lib/types";
import type { ActResult } from "~/routes/act";
import { useRoot } from "./root-data";

type Fields = Record<string, string | number | null | undefined | (string | number)[]>;

/** A fetcher for /act that toasts its outcome once, and says when it's done. */
export function useAct({ onDone }: { onDone?: () => void } = {}) {
  const fetcher = useFetcher<ActResult>();
  const seen = useRef<ActResult | undefined>(undefined);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data || fetcher.data === seen.current) return;
    seen.current = fetcher.data;
    if (fetcher.data.ok) {
      if (fetcher.data.message) toast.success(fetcher.data.message);
      onDone?.();
    } else {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data, onDone]);
  return { fetcher, pending: fetcher.state !== "idle" };
}

function Hidden({ intent, fields }: { intent: string; fields: Fields }) {
  return (
    <>
      <input type="hidden" name="intent" value={intent} />
      {Object.entries(fields).flatMap(([name, value]) =>
        (Array.isArray(value) ? value : [value]).map((v, i) => <input key={`${name}${i}`} type="hidden" name={name} value={v ?? ""} />),
      )}
    </>
  );
}

/** One button, one change, no reason needed (approve a photo, mark handled). */
export function ActButton({
  intent,
  fields = {},
  children,
  ...button
}: { intent: string; fields?: Fields; children: ReactNode } & Omit<React.ComponentProps<typeof Button>, "type" | "form">) {
  const { fetcher, pending } = useAct();
  return (
    <fetcher.Form method="post" action="/act" className="contents">
      <Hidden intent={intent} fields={fields} />
      <Button type="submit" disabled={pending || button.disabled} {...button}>
        {pending && <Spinner data-icon="inline-start" />}
        {children}
      </Button>
    </fetcher.Form>
  );
}

/**
 * A change that needs a reason for the audit log, asked in a dialog. `destructive` asks in an alert
 * dialog instead (bans, deletions). Extra inputs go in `children`.
 */
export function ReasonDialog({
  intent,
  fields = {},
  title,
  description,
  label = "Reason",
  placeholder = "What you saw, for the audit log",
  submit,
  destructive = false,
  defaultReason = "",
  required = true,
  reasonName = "reason",
  open,
  onOpenChange,
  trigger,
  children,
}: {
  intent: string;
  fields?: Fields;
  title: ReactNode;
  description?: ReactNode;
  label?: string;
  placeholder?: string;
  submit: string;
  destructive?: boolean;
  defaultReason?: string;
  required?: boolean;
  reasonName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  children?: ReactNode;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;
  const { fetcher, pending } = useAct({ onDone: () => setOpen(false) });

  const form = (
    <fetcher.Form method="post" action="/act" className="grid gap-6">
      <Hidden intent={intent} fields={fields} />
      <FieldGroup>
        {children}
        <Field>
          <FieldLabel htmlFor={`${intent}-${reasonName}`}>{label}</FieldLabel>
          <Textarea
            id={`${intent}-${reasonName}`}
            name={reasonName}
            required={required}
            maxLength={1000}
            rows={3}
            defaultValue={defaultReason}
            placeholder={placeholder}
            autoFocus
          />
          {required && <FieldDescription>Saved with your email in the audit log.</FieldDescription>}
        </Field>
      </FieldGroup>
      {destructive ? (
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
          <Button type="submit" variant="destructive" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {submit}
          </Button>
        </AlertDialogFooter>
      ) : (
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {submit}
          </Button>
        </DialogFooter>
      )}
    </fetcher.Form>
  );

  if (destructive) {
    return (
      <>
        {trigger && <span onClick={() => setOpen(true)}>{trigger}</span>}
        <AlertDialog open={isOpen} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
            </AlertDialogHeader>
            {form}
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }
  return (
    <>
      {trigger && <span onClick={() => setOpen(true)}>{trigger}</span>}
      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    </>
  );
}

const restrictions: { state: Hold; label: string; icon: typeof ShieldBanIcon; description: string }[] = [
  { state: "review", label: "Hold for review", icon: ShieldQuestionIcon, description: "Freezes the account until someone clears it." },
  { state: "selfie", label: "Ask for a selfie", icon: ScanFaceIcon, description: "Freezes the account until they send a selfie." },
  { state: "banned", label: "Ban", icon: ShieldBanIcon, description: "Closes it for good: its email, phone and sign-ins can't come back." },
];

const unblockText: Record<Hold, { title: string; description: string }> = {
  review: { title: "Clear the review", description: "The account comes back as it was, and they're emailed that they're back." },
  selfie: { title: "Drop the selfie request", description: "The account comes back without sending a selfie, and they're emailed that they're back." },
  banned: { title: "Lift the ban", description: "The account comes back, and its email, phone and sign-ins can be used again." },
};

/**
 * Restrict: puts a hold on the account (or a stricter one), each asking why; a ban asks in an alert
 * dialog. Moderators and admins.
 */
export function RestrictMenu({ user, name, current, size = "default" }: { user: string; name: string; current: Hold | null; size?: "sm" | "default" }) {
  const { staff } = useRoot();
  const [chosen, setChosen] = useState<Hold | null>(null);
  if (!can(staff, "moderator") || current === "banned") return null;
  const choices = restrictions.filter((c) => c.state !== current);
  const choice = restrictions.find((c) => c.state === chosen);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size}>
            <ShieldIcon data-icon="inline-start" />
            Restrict
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>{current ? "Change the restriction" : `Restrict ${name || "this account"}`}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {choices.map((c) => (
            <DropdownMenuItem key={c.state} variant={c.state === "banned" ? "destructive" : "default"} onSelect={() => setChosen(c.state)}>
              <c.icon />
              {c.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {choice && (
        <ReasonDialog
          key={choice.state}
          intent="hold"
          fields={{ user, state: choice.state }}
          open={chosen !== null}
          onOpenChange={(open) => !open && setChosen(null)}
          destructive={choice.state === "banned"}
          title={`${choice.label}: ${name || "this account"}`}
          description={choice.description}
          submit={choice.label}
        />
      )}
    </>
  );
}

/** Unblock: lifts whatever hold the account is under, after a confirmation. A ban takes an admin. */
export function UnblockButton({ user, name, current, size = "default" }: { user: string; name: string; current: Hold | null; size?: "sm" | "default" }) {
  const { staff } = useRoot();
  if (!current || !can(staff, "moderator")) return null;
  const text = unblockText[current];
  if (current === "banned" && !can(staff, "admin")) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <Button size={size} disabled>
              <ShieldCheckIcon data-icon="inline-start" />
              Unblock
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Lifting a ban takes an admin</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <ReasonDialog
      intent="hold"
      fields={{ user, state: "" }}
      title={`${text.title}: ${name || "this account"}?`}
      description={text.description}
      placeholder="Why it can come back"
      submit="Unblock"
      trigger={
        <Button size={size}>
          <ShieldCheckIcon data-icon="inline-start" />
          Unblock
        </Button>
      }
    />
  );
}

/** Both, side by side: Restrict, and Unblock when the account is held. */
export function HoldControls(props: { user: string; name: string; current: Hold | null; size?: "sm" | "default" }) {
  return (
    <>
      <RestrictMenu {...props} />
      <UnblockButton {...props} />
    </>
  );
}

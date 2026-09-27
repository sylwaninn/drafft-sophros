import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFetcher } from "react-router";
import type { ActResult } from "~/routes/act";
import type { Hold } from "~/lib/types";
import { can } from "~/lib/roles";
import { cx, useRoot } from "./ui";

const buttonTones = {
  primary: "bg-ink text-canvas hover:bg-ink/85",
  lime: "bg-lime text-ink hover:bg-lime/80",
  danger: "bg-negative text-canvas hover:bg-negative-deep",
  quiet: "bg-soft-2 text-ink hover:bg-line",
} as const;

export function Button({
  tone = "quiet",
  pending,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof buttonTones; pending?: boolean }) {
  return (
    <button
      {...props}
      disabled={pending || props.disabled}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        buttonTones[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-sm placeholder:text-mute focus:border-ink/40 focus:outline-none";

/**
 * A change posted to /act. Hidden `fields` say what it's about; children hold the inputs and buttons.
 * `confirm`: asked before sending (bans, deletions).
 */
export function ActForm({
  intent,
  fields = {},
  confirm,
  resetOnSuccess = false,
  children,
  className,
}: {
  intent: string;
  fields?: Record<string, string | number | string[] | null | undefined>;
  confirm?: string;
  resetOnSuccess?: boolean;
  children: (state: { pending: boolean }) => ReactNode;
  className?: string;
}) {
  const fetcher = useFetcher<ActResult>();
  const form = useRef<HTMLFormElement>(null);
  const pending = fetcher.state !== "idle";
  const result = pending ? undefined : fetcher.data;

  useEffect(() => {
    if (resetOnSuccess && fetcher.state === "idle" && fetcher.data?.ok) form.current?.reset();
  }, [resetOnSuccess, fetcher.state, fetcher.data]);

  return (
    <fetcher.Form
      ref={form}
      method="post"
      action="/act"
      className={className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      <input type="hidden" name="intent" value={intent} />
      {Object.entries(fields).flatMap(([name, value]) =>
        (Array.isArray(value) ? value : [value]).map((v, i) => <input key={`${name}${i}`} type="hidden" name={name} value={v ?? ""} />),
      )}
      {children({ pending })}
      {result && !result.ok && <p className="mt-2 text-xs font-medium text-negative-deep">{result.error}</p>}
      {result?.ok && result.message && <p className="mt-2 text-xs text-positive-deep">{result.message}</p>}
    </fetcher.Form>
  );
}

const holdOptions: { value: Hold | ""; label: string }[] = [
  { value: "review", label: "Hold for review" },
  { value: "selfie", label: "Ask for a selfie" },
  { value: "banned", label: "Ban" },
  { value: "", label: "Lift the hold" },
];

/** Put a hold on an account, change it, or lift it, with the reason (moderators; lifting a ban: admins). */
export function HoldForm({ user, current }: { user: string; current: Hold | null }) {
  const { staff } = useRoot();
  const [state, setState] = useState<Hold | "">(current ? "" : "review");
  if (!can(staff, "moderator")) return <p className="text-sm text-mute">Holds are for moderators.</p>;
  const options = holdOptions.filter(
    (o) => o.value !== current && (o.value !== "" || current) && !(current === "banned" && !can(staff, "admin")),
  );
  if (!options.length) return <p className="text-sm text-mute">Lifting a ban takes an admin.</p>;
  const chosen = options.some((o) => o.value === state) ? state : options[0].value;
  return (
    <ActForm
      intent="hold"
      fields={{ user, state: chosen }}
      confirm={chosen === "banned" ? "Ban this account? Its email, phone and sign-ins can't come back." : undefined}
      resetOnSuccess
      className="space-y-2"
    >
      {({ pending }) => (
        <>
          <div className="flex flex-wrap gap-1">
            {options.map((o) => (
              <button
                key={o.value || "lift"}
                type="button"
                onClick={() => setState(o.value)}
                className={cx(
                  "rounded-lg border px-2.5 py-1 text-xs font-medium",
                  chosen === o.value ? "border-ink bg-ink text-canvas" : "border-line text-body hover:border-ink/40",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <textarea name="reason" required rows={2} maxLength={1000} placeholder="Why (goes to the audit log)" className={inputClass} />
          <Button tone={chosen === "banned" ? "danger" : "primary"} pending={pending}>
            {options.find((o) => o.value === chosen)?.label}
          </Button>
        </>
      )}
    </ActForm>
  );
}

/** A reason and one button: the common shape of moderator actions. */
export function ReasonAction({
  intent,
  fields,
  label,
  placeholder = "Why (goes to the audit log)",
  tone = "primary",
  confirm,
  required = true,
}: {
  intent: string;
  fields: Record<string, string | null | undefined>;
  label: string;
  placeholder?: string;
  tone?: "primary" | "danger" | "lime" | "quiet";
  confirm?: string;
  required?: boolean;
}) {
  return (
    <ActForm intent={intent} fields={fields} confirm={confirm} resetOnSuccess className="flex flex-wrap items-start gap-2">
      {({ pending }) => (
        <>
          <input name="reason" required={required} maxLength={1000} placeholder={placeholder} className={cx(inputClass, "min-w-48 flex-1")} />
          <Button tone={tone} pending={pending}>
            {label}
          </Button>
        </>
      )}
    </ActForm>
  );
}

export function NoteForm({ user }: { user: string }) {
  return (
    <ActForm intent="note" fields={{ user }} resetOnSuccess className="space-y-2">
      {({ pending }) => (
        <>
          <textarea name="body" required rows={2} maxLength={2000} placeholder="A note for the team" className={inputClass} />
          <Button tone="primary" pending={pending}>
            Add note
          </Button>
        </>
      )}
    </ActForm>
  );
}

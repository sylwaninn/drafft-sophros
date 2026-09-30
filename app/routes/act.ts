// Every change the dashboard makes, in one place: pages post here (fetchers) and read `{ ok }` or
// `{ error }` back; React Router then reloads what's on screen. The database checks the role and writes
// the audit log for each of them; Stream changes are logged through admin_log. A decision the member is
// told about (a hold put, a photo refused, a message deleted) carries its reason category and the team's
// note for them (`category`, `details`): the category is required and must be one the database lists,
// checked here before any call (and again by the database).
import { data } from "react-router";
import { staffContext } from "~/lib/context";
import { DbError, rpc } from "~/lib/.server/db";
import { refusalMessage, refusals as errors, type RefusalCode } from "~/lib/refusals";
import { deleteMessage } from "~/lib/.server/stream";
import { DETAILS_MAX, isOverrideBasis, reasonCategories, RESOLUTION_MAX, type Told } from "~/lib/reasons";
import type { Staff } from "~/lib/roles";
import { isHold, type Hold } from "~/lib/types";
import type { Route } from "./+types/act";

export type ActResult = { ok: true; message?: string } | { ok: false; error: string };

/** A refusal decided here, before the database: codes and messages like its own. */
export class Refusal extends Error {
  constructor(readonly code: RefusalCode) {
    super(errors[code]);
  }
}

/**
 * The category ids the database lists, read once per request and only for a decision that tells the
 * member. Null when they can't be read: the database still checks the category itself.
 */
function categoryIds(staff: Staff) {
  let ids: Promise<string[] | null> | undefined;
  return () =>
    (ids ??= rpc<unknown>(staff, "admin_reason_categories").then(
      (value) => reasonCategories(value).map((c) => c.id),
      (error: unknown) => {
        console.error("act admin_reason_categories", error);
        return null;
      },
    ));
}

export async function action({ request, context }: Route.ActionArgs) {
  const staff = context.get(staffContext);
  // Changes come as a posted form, and only as that.
  if (request.method !== "POST")
    return data({ ok: false, error: "Changes are posted." } satisfies ActResult, { status: 405, headers: { allow: "POST" } });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return result({ ok: false, error: "That wasn't a form." }, 400);
  }
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const intent = text("intent");
  // What the member is told with the decision: its reason category (required, one the database lists)
  // and the team's note.
  const known = categoryIds(staff);
  const told = async () => {
    const fields = { category: text("category"), details: text("details") };
    // No category, or too long a note: refused before any call, the list included.
    statementArgs(fields);
    return statementArgs(fields, await known());
  };

  try {
    switch (intent) {
      case "hold": {
        const state = text("state");
        if (state && !isHold(state)) return result({ ok: false, error: "Unknown hold." }, 400);
        // Lifting a hold states nothing: they're emailed that they're back.
        await rpc(staff, "admin_set_hold", {
          p_user: text("user"),
          p_state: state || null,
          p_reason: text("reason"),
          ...(state ? await told() : {}),
        });
        return result({ ok: true, message: state ? "Hold set: they're told why." : "Hold lifted." });
      }
      case "revoke-sessions": {
        await rpc<number>(staff, "admin_revoke_sessions", { p_user: text("user"), p_reason: text("reason") });
        return result({ ok: true, message: "Signed out everywhere." });
      }
      case "note":
        if (!text("body")) return result({ ok: false, error: "Write something first." });
        await rpc(staff, "admin_add_note", { p_user: text("user"), p_body: text("body") });
        return result({ ok: true, message: "Note added." });
      case "media": {
        const approved = text("approved") === "true";
        await rpc(staff, "admin_review_media", {
          p_media: text("media"),
          p_approved: approved,
          p_reason: text("reason") || null,
          ...(approved ? {} : await told()),
        });
        return result({ ok: true, message: approved ? undefined : "Photo refused: they're told why." });
      }
      case "flags":
        await rpc(staff, "admin_resolve_flags", {
          p_ids: form.getAll("id").map(Number).filter(Number.isFinite),
          p_reason: text("reason") || null,
        });
        return result({ ok: true });
      case "report": {
        // One transaction: closing and holding land together, or not at all (a report already closed).
        const hold = text("hold");
        if (hold && !isHold(hold)) return result({ ok: false, error: "Unknown hold." }, 400);
        // The hold's reason repeats the resolution after "report: ", within the audit log's limit.
        if (hold && text("resolution").length > RESOLUTION_MAX)
          return result({ ok: false, error: `With a hold, the resolution is ${RESOLUTION_MAX} characters at most.` }, 400);
        await rpc(staff, "admin_close_report", {
          p_report: text("report"),
          p_resolution: text("resolution"),
          p_hold: hold || null,
          ...(hold ? await told() : {}),
        });
        return result({ ok: true, message: "Report closed." });
      }
      case "support":
        await rpc(staff, "admin_set_support_handled", { p_id: Number(text("id")), p_handled: text("handled") === "true" });
        return result({ ok: true });
      case "support-reply":
        // The key the reply form made when it opened: the same reply sent twice (a double press, a retried
        // request) is one message and one email, the database sees to it.
        await rpc(staff, "admin_reply_support", {
          p_id: Number(text("id")),
          p_body: text("body"),
          p_close: text("close") === "true",
          p_idempotency_key: idempotencyKey(text("key")),
        });
        return result({ ok: true, message: text("close") === "true" ? "Reply sent, request closed." : "Reply sent." });
      case "events-replay": {
        const ids = eventIds(form);
        if (!ids) return result({ ok: false, error: errors.invalid_ids }, 400);
        const count = await rpc<number>(staff, "admin_replay_events", { p_ids: ids, p_reason: text("reason") || null });
        return result({
          ok: true,
          message: count ? `${count} event${count === 1 ? "" : "s"} sent again.` : "Nothing to replay: already handled.",
        });
      }
      case "events-discard": {
        const ids = eventIds(form);
        if (!ids) return result({ ok: false, error: errors.invalid_ids }, 400);
        const count = await rpc<number>(staff, "admin_discard_events", { p_ids: ids, p_reason: text("reason") });
        return result({
          ok: true,
          message: count ? `${count} event${count === 1 ? "" : "s"} discarded.` : "Nothing to discard: already handled.",
        });
      }
      case "data-request":
        await rpc(staff, "admin_fulfil_data_request", { p_id: Number(text("id")) });
        return result({ ok: true });
      case "staff":
        await rpc(staff, "admin_set_staff", { p_email: text("email"), p_role: text("role") || null });
        return result({ ok: true, message: "Staff updated." });
      case "decide": {
        const decision = parseDecision(text("decision"));
        const tells = !!decision && typeof decision === "object" && Boolean((decision as { category?: unknown }).category);
        const call = decisionCall(decision, tells ? await known() : null);
        if (!call) return result({ ok: false, error: "Unknown decision." }, 400);
        await rpc(staff, call.fn, call.args);
        return result({ ok: true, message: text("message") || undefined });
      }
      case "delete-message": {
        // Logged first: if Stream fails, the attempt is still on record. The database checks the
        // conversation's basis again (or the override it was opened with, and why), and tells the author
        // once Stream shows the message removed.
        const override = text("override") === "true";
        const overrideBasis = text("override_basis");
        if (override && !isOverrideBasis(overrideBasis)) throw new Refusal("override_basis_required");
        await rpc(staff, "admin_log", {
          p_action: "message.delete",
          p_user: text("user") || null,
          p_target: `${text("match")}/${text("message")}`,
          p_reason: text("reason"),
          p_override: override,
          ...(override ? { p_override_basis: overrideBasis } : {}),
          ...(await told()),
        });
        await deleteMessage(text("message"));
        return result({ ok: true, message: "Message deleted: its author is told why." });
      }
      default:
        return result({ ok: false, error: `Unknown action ${intent}` }, 400);
    }
  } catch (error) {
    if (error instanceof Refusal) return result({ ok: false, error: error.message }, 400);
    if (error instanceof DbError)
      return result({ ok: false, error: refusalMessage(error.code) ?? error.message }, error.status === 403 ? 403 : 400);
    console.error(`act ${intent}`, error);
    return result({ ok: false, error: error instanceof Error ? error.message : "Something went wrong." }, 500);
  }
}

/** A review decision as the queues post it: the ones the member is told about carry their statement. */
export type Decision =
  | { intent: "media"; media: string; approved: true; reason?: string }
  | ({ intent: "media"; media: string; approved: false; reason?: string } & Told)
  | { intent: "flags"; ids: number[]; reason?: string; hold?: undefined }
  | ({ intent: "flags"; ids: number[]; reason?: string; hold: Hold; holdReason?: string } & Told)
  | ({ intent: "photo"; media: string; reason?: string; hold?: Hold } & Told);

function parseDecision(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * What a decision tells the member: `p_category`, required, and `p_details`, the team's note sent as
 * written. A Refusal, before any call, for a missing category, one not in `categories` (the ids the
 * database lists; null when they couldn't be read, left to the database) or a note too long.
 */
export function statementArgs(value: { category?: unknown; details?: unknown }, categories: readonly string[] | null = null) {
  const category = typeof value.category === "string" ? value.category.trim() : "";
  const details = typeof value.details === "string" ? value.details.trim() : "";
  if (!category) throw new Refusal("category_required");
  if (categories && !categories.includes(category)) throw new Refusal("invalid_category");
  if (details.length > DETAILS_MAX) throw new Refusal("details_too_long");
  return { p_category: category, p_details: details || null };
}

/**
 * One review decision, one database call: refusing a photo, closing a flag and holding the account
 * happen in a single transaction, so a refused hold leaves the rest undone (no half-applied decision).
 * Null when the decision isn't one the dashboard makes. One the member is told about (a photo refused,
 * a hold) carries its statement, and throws a Refusal without a category (or one not in `categories`).
 */
export function decisionCall(
  value: unknown,
  categories: readonly string[] | null = null,
): { fn: `admin_${string}`; args: Record<string, unknown> } | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Record<string, unknown>;
  const reason = typeof d.reason === "string" && d.reason.trim() ? d.reason : null;
  if (d.hold !== undefined && !isHold(d.hold)) return null;
  const hold = (d.hold as Hold | undefined) ?? null;
  switch (d.intent) {
    case "media":
      if (typeof d.media !== "string" || typeof d.approved !== "boolean") return null;
      return {
        fn: "admin_review_media",
        args: { p_media: d.media, p_approved: d.approved, p_reason: reason, ...(d.approved ? {} : statementArgs(d, categories)) },
      };
    case "flags":
      if (!Array.isArray(d.ids) || d.ids.length === 0 || d.ids.length > 500 || !d.ids.every(Number.isInteger)) return null;
      if (d.holdReason !== undefined && typeof d.holdReason !== "string") return null;
      return {
        fn: "admin_decide_flags",
        args: {
          p_ids: d.ids,
          p_reason: reason,
          p_hold: hold,
          p_hold_reason: hold ? (d.holdReason ?? null) : null,
          ...(hold ? statementArgs(d, categories) : {}),
        },
      };
    case "photo":
      // A photo waiting for a person is refused (they're told), with the hold that may come along.
      if (typeof d.media !== "string") return null;
      return { fn: "admin_decide_photo", args: { p_media: d.media, p_reason: reason, p_hold: hold, ...statementArgs(d, categories) } };
    default:
      return null;
  }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A reply's idempotency key, or null (an old form without one, or anything that isn't a UUID). */
export function idempotencyKey(value: string): string | null {
  return uuid.test(value) ? value.toLowerCase() : null;
}

/** The outbox events a replay or a discard names: 1 to 200 whole ids, or null. */
export function eventIds(form: FormData): number[] | null {
  const ids = form.getAll("id").map((v) => Number(v));
  if (ids.length === 0 || ids.length > 200 || !ids.every((id) => Number.isSafeInteger(id) && id > 0)) return null;
  return [...new Set(ids)];
}

function result(value: ActResult, status = 200) {
  return data(value, { status });
}

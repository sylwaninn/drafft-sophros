// Every change the dashboard makes, in one place: pages post here (fetchers) and read `{ ok }` or
// `{ error }` back; React Router then reloads what's on screen. The database checks the role and writes
// the audit log for each of them; Stream changes are logged through admin_log.
import { data } from "react-router";
import { staffContext } from "~/lib/context";
import { DbError, rpc } from "~/lib/.server/db";
import { deleteMessage } from "~/lib/.server/stream";
import type { Staff } from "~/lib/roles";
import type { Route } from "./+types/act";

export type ActResult = { ok: true; message?: string } | { ok: false; error: string };

const errors: Record<string, string> = {
  forbidden: "Your role doesn't allow this.",
  reason_required: "Say why: the reason goes to the audit log.",
  not_found: "It's gone, or already handled.",
  own_role: "You can't change your own role.",
  invalid_role: "Unknown role.",
  empty_reply: "Write the reply first.",
};

const holds = new Set<unknown>(["review", "selfie", "banned"]);

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

  try {
    switch (intent) {
      case "hold": {
        const state = text("state");
        if (state && !holds.has(state)) throw new Error("unknown hold");
        await rpc(staff, "admin_set_hold", { p_user: text("user"), p_state: state || null, p_reason: text("reason") });
        return result({ ok: true, message: state ? "Hold set." : "Hold lifted." });
      }
      case "revoke-sessions": {
        const count = await rpc<number>(staff, "admin_revoke_sessions", { p_user: text("user"), p_reason: text("reason") });
        return result({ ok: true, message: `${count} session${count === 1 ? "" : "s"} revoked.` });
      }
      case "note":
        if (!text("body")) return result({ ok: false, error: "Write something first." });
        await rpc(staff, "admin_add_note", { p_user: text("user"), p_body: text("body") });
        return result({ ok: true, message: "Note added." });
      case "media":
        await rpc(staff, "admin_review_media", {
          p_media: text("media"),
          p_approved: text("approved") === "true",
          p_reason: text("reason") || null,
        });
        return result({ ok: true });
      case "flags":
        await rpc(staff, "admin_resolve_flags", {
          p_ids: form.getAll("id").map(Number).filter(Number.isFinite),
          p_reason: text("reason") || null,
        });
        return result({ ok: true });
      case "report": {
        const hold = text("hold");
        if (hold) {
          if (!holds.has(hold)) throw new Error("unknown hold");
          await rpc(staff, "admin_set_hold", { p_user: text("user"), p_state: hold, p_reason: `report: ${text("resolution")}` });
        }
        await rpc(staff, "admin_resolve_report", { p_report: text("report"), p_resolution: text("resolution") });
        return result({ ok: true, message: "Report closed." });
      }
      case "support":
        await rpc(staff, "admin_set_support_handled", { p_id: Number(text("id")), p_handled: text("handled") === "true" });
        return result({ ok: true });
      case "support-reply":
        await rpc(staff, "admin_reply_support", { p_id: Number(text("id")), p_body: text("body"), p_close: text("close") === "true" });
        return result({ ok: true, message: text("close") === "true" ? "Reply sent, request closed." : "Reply sent." });
      case "data-request":
        await rpc(staff, "admin_fulfil_data_request", { p_id: Number(text("id")) });
        return result({ ok: true });
      case "staff":
        await rpc(staff, "admin_set_staff", { p_email: text("email"), p_role: text("role") || null });
        return result({ ok: true, message: "Staff updated." });
      case "batch":
        return result(await applyBatch(staff, text("ops"), text("message")));
      case "delete-message": {
        // Logged first: if Stream fails, the attempt is still on record.
        await rpc(staff, "admin_log", {
          p_action: "message.delete",
          p_user: text("user") || null,
          p_target: `${text("match")}/${text("message")}`,
          p_reason: text("reason"),
        });
        await deleteMessage(text("message"));
        return result({ ok: true, message: "Message deleted." });
      }
      default:
        return result({ ok: false, error: `Unknown action ${intent}` }, 400);
    }
  } catch (error) {
    if (error instanceof DbError)
      return result({ ok: false, error: errors[error.code] ?? error.message }, error.status === 403 ? 403 : 400);
    console.error(`act ${intent}`, error);
    return result({ ok: false, error: error instanceof Error ? error.message : "Something went wrong." }, 500);
  }
}

/**
 * One review decision, made of several changes applied in order (refuse a photo, hold its account,
 * close its flags). Each is checked here; a failed one doesn't stop the others, and the answer says so.
 */
async function applyBatch(staff: Staff, raw: string, message: string): Promise<ActResult> {
  let ops: BatchOp[];
  try {
    ops = JSON.parse(raw);
    if (!Array.isArray(ops) || ops.length === 0 || ops.length > 500) throw new Error();
  } catch {
    return { ok: false, error: "Nothing to apply." };
  }
  const failures: string[] = [];
  for (const op of ops) {
    try {
      if (op.intent === "media" && typeof op.media === "string" && typeof op.approved === "boolean") {
        await rpc(staff, "admin_review_media", { p_media: op.media, p_approved: op.approved, p_reason: op.reason ?? null });
      } else if (op.intent === "flags" && Array.isArray(op.ids) && op.ids.every(Number.isInteger)) {
        await rpc(staff, "admin_resolve_flags", { p_ids: op.ids, p_reason: op.reason ?? null });
      } else if (op.intent === "hold" && typeof op.user === "string" && holds.has(op.state) && op.reason?.trim()) {
        await rpc(staff, "admin_set_hold", { p_user: op.user, p_state: op.state, p_reason: op.reason });
      } else {
        failures.push("an unknown decision");
      }
    } catch (error) {
      failures.push(error instanceof DbError ? (errors[error.code] ?? error.message) : String(error));
    }
  }
  const done = ops.length - failures.length;
  if (failures.length) return { ok: false, error: done ? `Partly done, ${failures.length} change failed: ${failures[0]}` : failures[0] };
  return { ok: true, message: message || `${done} change${done === 1 ? "" : "s"} applied.` };
}

export type BatchOp =
  | { intent: "media"; media: string; approved: boolean; reason?: string }
  | { intent: "flags"; ids: number[]; reason?: string }
  | { intent: "hold"; user: string; state: "review" | "selfie" | "banned"; reason: string };

function result(value: ActResult, status = 200) {
  return data(value, { status });
}

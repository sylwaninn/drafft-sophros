// A conversation for the drawer, in two steps. GET: the match and its sessions, and whether it may be
// read (admin_conversation_access: its basis, and whether this person may do without one); no message,
// nothing logged. POST: its messages (Stream, or the canned demo ones locally), once the reading is
// logged on both accounts' trail (admin_log conversation.view) with the reason the person typed and
// where it was opened from. The database refuses a reading without a reason, or without a basis unless
// an admin overrides it; the refusal comes back as `{ ok: false }` for the drawer to explain.
import { data } from "react-router";
import { staffContext } from "~/lib/context";
import { getConfig } from "~/lib/.server/config";
import { DbError, query, rpc } from "~/lib/.server/db";
import { demoMessages } from "~/lib/.server/demo-chat";
import { refusals } from "~/lib/refusals";
import { channelMessages, type ChatMessage } from "~/lib/.server/stream";
import { typedReason, type ConversationAccess } from "~/lib/reasons";
import type { MatchRow } from "~/lib/types";
import type { Route } from "./+types/conversation-data";

export interface MatchDetail extends Omit<MatchRow, "sessions"> {
  sessions: {
    id: string;
    sport: string;
    status: string;
    chosenAt: string | null;
    proposer: string;
    title: string;
    note: string;
    createdAt: string;
  }[];
}

export interface ConversationGate {
  match: MatchDetail;
  access: ConversationAccess;
}

export type ConversationRead =
  | { ok: true; messages: { exists: boolean; messages: ChatMessage[]; hasMore: boolean } | null; error: string | null }
  | { ok: false; code: string; error: string };

const readRefusals: Record<string, string> = {
  reason_required: "Say why you're reading it: the reason goes to the audit log on both accounts.",
};

export async function loader({ params, context }: Route.LoaderArgs): Promise<ConversationGate> {
  const staff = context.get(staffContext);
  const [match, access] = await Promise.all([
    query<MatchDetail | null>(staff, "admin_match", { p_match: params.id }),
    query<ConversationAccess>(staff, "admin_conversation_access", { p_match: params.id }),
  ]);
  if (!match) throw data("No such match.", { status: 404 });
  return { match, access: { basis: access.basis ?? [], canOverride: access.canOverride === true } };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const staff = context.get(staffContext);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refused("invalid_form", "That wasn't a form.");
  }
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const override = text("override") === "true";
  // Checked here too: nothing is read, nor logged, without a reason of the person's own.
  const reason = typedReason(text("reason"));
  if (!reason) return refused("reason_required", readRefusals.reason_required);
  const match = await query<MatchDetail | null>(staff, "admin_match", { p_match: params.id });
  if (!match) return refused("not_found", refusals.not_found, 404);
  const from = text("from").slice(0, 200);
  try {
    await Promise.all(
      [match.a.id, match.b.id].map((user) =>
        rpc(staff, "admin_log", {
          p_action: "conversation.view",
          p_user: user,
          p_target: match.id,
          p_reason: from ? `${reason} (opened from ${from})` : reason,
          p_override: override,
        }),
      ),
    );
  } catch (error) {
    if (!(error instanceof DbError)) throw error;
    const message =
      error.code === "forbidden" && override
        ? "Reading a conversation without a basis takes an admin."
        : (readRefusals[error.code] ?? refusals[error.code] ?? error.message);
    return refused(error.code, message, error.status === 403 ? 403 : 400);
  }
  const config = getConfig();
  const demo = config.env === "local" && !config.stream ? demoMessages(match.a.id, match.b.id, config.demoMediaUrl) : null;
  if (demo) return read({ ok: true, messages: { exists: true, messages: demo, hasMore: false }, error: null });
  try {
    return read({ ok: true, messages: await channelMessages(match.id, 80, text("before") || undefined), error: null });
  } catch (error) {
    return read({ ok: true, messages: null, error: error instanceof Error ? error.message : "Stream didn't answer." });
  }
}

function read(value: ConversationRead) {
  return data(value);
}

function refused(code: string, error: string, status = 400) {
  return data({ ok: false, code, error } satisfies ConversationRead, { status });
}

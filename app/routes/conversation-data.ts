// A conversation for the drawer: the match, its sessions and its messages (Stream, or the canned demo
// ones locally). Every loading is logged on both accounts' trail (conversation.view), with where it
// was opened from.
import { data } from "react-router";
import { staffContext } from "~/lib/context";
import { getConfig } from "~/lib/.server/config";
import { query, rpc } from "~/lib/.server/db";
import { demoMessages } from "~/lib/.server/demo-chat";
import { channelMessages, type ChatMessage } from "~/lib/.server/stream";
import type { MatchRow } from "~/lib/types";
import type { Route } from "./+types/conversation-data";

export interface MatchDetail extends Omit<MatchRow, "sessions"> {
  sessions: { id: string; sport: string; status: string; chosenAt: string | null; proposer: string; title: string; note: string; createdAt: string }[];
}

export interface ConversationData {
  match: MatchDetail;
  messages: { exists: boolean; messages: ChatMessage[]; hasMore: boolean } | null;
  error: string | null;
}

export async function loader({ params, request, context }: Route.LoaderArgs): Promise<ConversationData> {
  const staff = context.get(staffContext);
  const url = new URL(request.url);
  const match = await query<MatchDetail | null>(staff, "admin_match", { p_match: params.id });
  if (!match) throw data("No such match.", { status: 404 });
  const from = url.searchParams.get("from")?.trim().slice(0, 200) || "opened in sophros";
  await Promise.all(
    [match.a.id, match.b.id].map((user) =>
      rpc(staff, "admin_log", { p_action: "conversation.view", p_user: user, p_target: match.id, p_reason: from }),
    ),
  );
  const config = getConfig();
  const demo = config.env === "local" && !config.stream ? demoMessages(match.a.id, match.b.id, config.demoMediaUrl) : null;
  if (demo) return { match, messages: { exists: true, messages: demo, hasMore: false }, error: null };
  try {
    return { match, messages: await channelMessages(match.id, 80, url.searchParams.get("before") ?? undefined), error: null };
  } catch (error) {
    return { match, messages: null, error: error instanceof Error ? error.message : "Stream didn't answer." };
  }
}

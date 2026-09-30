// The answer to a request for a conversation's older messages (conversation-data, posted by the drawer
// outside a fetcher), read defensively: a refusal, Stream's failure and a server error all say why,
// instead of the conversation looking like it starts there.
import type { ConversationPage, ConversationRead } from "~/routes/conversation-data";

export type OlderMessages = { ok: true; page: ConversationPage } | { ok: false; error: string };

export async function olderMessages(res: Response): Promise<OlderMessages> {
  const json = (res.headers.get("content-type") ?? "").includes("application/json");
  if (!json) {
    console.error("older messages", res.status, await res.text().catch(() => ""));
    return { ok: false, error: `The older messages couldn't be read (HTTP ${res.status}).` };
  }
  const answer = (await res.json()) as ConversationRead;
  if (!answer.ok) return { ok: false, error: answer.error };
  if (!answer.messages) return { ok: false, error: `Stream couldn't be read: ${answer.streamError}` };
  return { ok: true, page: answer.messages };
}

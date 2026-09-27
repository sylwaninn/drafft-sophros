// Stream Chat's server REST API (one `messaging` channel per match, the match id as channel id), with a
// server token signed here from the app secret. Plain fetch: the Node SDK isn't needed for two calls.
import { SignJWT } from "jose";
import { getConfig } from "./config";

const base = "https://chat.stream-io-api.com";

export interface ChatAttachment {
  type?: string;
  image_url?: string;
  thumb_url?: string;
  asset_url?: string;
  title?: string;
  mime_type?: string;
}

export interface ChatMessage {
  id: string;
  text?: string;
  type: string;
  user?: { id: string; name?: string };
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
  attachments?: ChatAttachment[];
  quoted_message_id?: string;
  latest_reactions?: { type: string; user_id?: string }[];
  [custom: string]: unknown;
}

let token: { value: string; secret: string } | undefined;

async function serverToken(secret: string): Promise<string> {
  if (token?.secret !== secret) {
    const value = await new SignJWT({ server: true })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .sign(new TextEncoder().encode(secret));
    token = { value, secret };
  }
  return token.value;
}

async function request<T>(method: string, path: string, body?: unknown, query: Record<string, string> = {}): Promise<T> {
  const stream = getConfig().stream;
  if (!stream) throw new Error("Stream isn't configured for this environment (STREAM_API_KEY, STREAM_API_SECRET).");
  const url = new URL(path, base);
  url.searchParams.set("api_key", stream.key);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      authorization: await serverToken(stream.secret),
      "stream-auth-type": "jwt",
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Stream ${method} ${path}: ${res.status} ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** A match's messages, oldest first, `limit` of them before `before` (a message id), or the latest. */
export async function channelMessages(matchId: string, limit = 60, before?: string) {
  try {
    const res = await request<{ messages: ChatMessage[]; channel?: { frozen?: boolean; created_at?: string } }>(
      "POST",
      `/channels/messaging/${encodeURIComponent(matchId)}/query`,
      { state: true, watch: false, presence: false, messages: { limit, ...(before ? { id_lt: before } : {}) } },
    );
    return { exists: true, messages: res.messages ?? [], hasMore: (res.messages?.length ?? 0) >= limit };
  } catch (error) {
    // No channel yet: a match nobody wrote in (channels are created on the first event).
    if (String(error).includes(": 404 ")) return { exists: false, messages: [], hasMore: false };
    throw error;
  }
}

/** Soft delete: the message shows as deleted to both people. */
export async function deleteMessage(messageId: string) {
  await request("DELETE", `/messages/${encodeURIComponent(messageId)}`);
}

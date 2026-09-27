// A match's conversation, read from Stream. Opening it takes a reason, logged on both accounts with the
// staff member's email before a single message is fetched (admin_log, conversation.view), at every
// loading, older pages included.
import { Form, Link, useSearchParams } from "react-router";
import { staffContext } from "~/lib/context";
import { query, rpc } from "~/lib/.server/db";
import { channelMessages, type ChatMessage } from "~/lib/.server/stream";
import type { MatchRow } from "~/lib/types";
import { ActForm, Button, inputClass } from "~/components/actions";
import { Badge, Card, Empty, Page, PersonLink, Time, cx, formatDate } from "~/components/ui";
import type { Route } from "./+types/conversation";

interface MatchDetail extends Omit<MatchRow, "sessions"> {
  sessions: { id: string; sport: string; status: string; chosenAt: string | null; proposer: string; title: string; note: string; createdAt: string }[];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const staff = context.get(staffContext);
  const url = new URL(request.url);
  const reason = url.searchParams.get("reason")?.trim() ?? "";
  const match = await query<MatchDetail | null>(staff, "admin_match", { p_match: params.id });
  if (!match) return { match: null, reason, messages: null };
  if (!reason) return { match, reason, messages: null };

  await Promise.all(
    [match.a.id, match.b.id].map((user) =>
      rpc(staff, "admin_log", { p_action: "conversation.view", p_user: user, p_target: match.id, p_reason: reason }),
    ),
  );
  const messages = await channelMessages(match.id, 80, url.searchParams.get("before") ?? undefined);
  return { match, reason, messages };
}

export default function Conversation({ loaderData: { match, reason, messages } }: Route.ComponentProps) {
  const [params] = useSearchParams();
  if (!match) {
    return (
      <Page title="Conversation">
        <Empty>No such match.</Empty>
      </Page>
    );
  }
  const names: Record<string, string> = { [match.a.id]: match.a.name ?? "", [match.b.id]: match.b.name ?? "" };

  return (
    <Page
      title={
        <span className="flex flex-wrap items-center gap-3">
          <PersonLink person={match.a} /> <span className="text-mute">and</span> <PersonLink person={match.b} />
        </span>
      }
      subtitle={
        <>
          Matched <Time value={match.createdAt} exact />
          {match.endedAt && (
            <>
              , ended <Time value={match.endedAt} exact /> by {names[match.endedBy ?? ""] || "one of them"}
            </>
          )}
        </>
      }
    >
      {!messages ? (
        <Card title="Why are you opening this conversation?" className="max-w-xl">
          <p className="mb-3 text-sm text-body">
            Private messages. Reading them is logged with your email and this reason, and shown on both accounts' staff trail.
          </p>
          <Form method="get" className="flex gap-2">
            <input name="reason" required autoFocus defaultValue={params.get("suggest") ?? ""} maxLength={300} placeholder="Report, hold, investigation" className={inputClass} />
            <Button tone="primary">Open</Button>
          </Form>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <Card aside={<>reason: {reason}</>} title="Messages">
            {!messages.exists ? (
              <Empty>No chat channel: nobody wrote yet.</Empty>
            ) : messages.messages.length === 0 ? (
              <Empty>No message.</Empty>
            ) : (
              <>
                {messages.hasMore && (
                  <div className="mb-3 text-center">
                    <Link className="text-sm underline" to={`?${new URLSearchParams({ reason, before: messages.messages[0].id })}`}>
                      Older messages
                    </Link>
                  </div>
                )}
                <ol className="space-y-2">
                  {messages.messages.map((m) => (
                    <Bubble key={m.id} message={m} left={m.user?.id === match.a.id} name={names[m.user?.id ?? ""] ?? m.user?.name} matchId={match.id} />
                  ))}
                </ol>
                {params.get("before") && (
                  <div className="mt-3 text-center">
                    <Link className="text-sm underline" to={`?${new URLSearchParams({ reason })}`}>
                      Latest messages
                    </Link>
                  </div>
                )}
              </>
            )}
          </Card>
          <Card title="Sessions" className="lg:self-start">
            {match.sessions.length === 0 ? (
              <Empty>None proposed.</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {match.sessions.map((s) => (
                  <li key={s.id}>
                    <div className="flex items-center gap-2">
                      <Badge tone={s.status === "accepted" ? "lime" : "neutral"}>{s.status}</Badge>
                      <span>{s.sport}</span>
                    </div>
                    <div className="text-xs text-mute">
                      by {names[s.proposer]}, {s.chosenAt ? formatDate(s.chosenAt) : <Time value={s.createdAt} />}
                    </div>
                    {s.note && <p className="text-xs text-body">{s.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </Page>
  );
}

/** Attachment links come from the sender's client: only web addresses. */
function safe(url: string | undefined) {
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}

function Bubble({ message: m, left, name, matchId }: { message: ChatMessage; left: boolean; name?: string; matchId: string }) {
  const deleted = m.type === "deleted" || Boolean(m.deleted_at);
  const system = m.type === "system" || !m.user;
  const custom = Object.fromEntries(
    Object.entries(m).filter(
      ([k]) =>
        !["id", "text", "html", "type", "user", "created_at", "updated_at", "deleted_at", "attachments", "latest_reactions", "own_reactions", "reaction_counts", "reaction_scores", "reaction_groups", "reply_count", "deleted_reply_count", "cid", "mentioned_users", "silent", "pinned", "pinned_at", "pinned_by", "pin_expires", "shadowed", "status", "quoted_message_id", "quoted_message", "i18n", "restricted_visibility", "member", "channel_cid"].includes(k),
    ),
  );
  if (system) {
    return <li className="text-center text-xs text-mute">{m.text || JSON.stringify(custom)}</li>;
  }
  return (
    <li className={cx("group flex flex-col", left ? "items-start" : "items-end")}>
      <div className="mb-0.5 text-[11px] text-mute">
        {name}, <Time value={m.created_at} exact />
      </div>
      <div className={cx("max-w-[75%] rounded-2xl px-3 py-2 text-sm", deleted ? "border border-dashed border-line text-mute italic" : left ? "bg-soft-2" : "bg-lime-pale")}>
        {deleted && <div className="text-xs">deleted</div>}
        {m.quoted_message_id && <div className="mb-1 text-xs text-mute">replying to a message</div>}
        {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
        {m.attachments?.map((a, i) =>
          safe(a.image_url) || safe(a.thumb_url) ? (
            <a key={i} href={safe(a.image_url) ?? safe(a.thumb_url)} target="_blank" rel="noreferrer noopener">
              <img src={safe(a.thumb_url) ?? safe(a.image_url)} alt="" referrerPolicy="no-referrer" loading="lazy" className="mt-1 max-h-64 rounded-lg" />
            </a>
          ) : safe(a.asset_url) ? (
            <a key={i} href={safe(a.asset_url)} target="_blank" rel="noreferrer noopener" className="mt-1 block underline">
              {a.title || a.type || "attachment"}
            </a>
          ) : null,
        )}
        {Object.keys(custom).length > 0 && <pre className="mt-1 overflow-x-auto text-[11px] text-body">{JSON.stringify(custom, null, 1)}</pre>}
        {m.latest_reactions && m.latest_reactions.length > 0 && <div className="mt-1 text-xs">{m.latest_reactions.map((r) => r.type).join(" ")}</div>}
      </div>
      {!deleted && (
        <details className="mt-0.5 text-xs text-mute opacity-0 group-hover:opacity-100 open:opacity-100">
          <summary className="cursor-pointer">delete</summary>
          <ActForm intent="delete-message" fields={{ match: matchId, message: m.id, user: m.user?.id }} confirm="Delete this message for both people?" className="mt-1 flex gap-1">
            {({ pending }) => (
              <>
                <input name="reason" required placeholder="Why" className={cx(inputClass, "w-48 py-1 text-xs")} />
                <Button tone="danger" pending={pending} className="py-1 text-xs">
                  Delete
                </Button>
              </>
            )}
          </ActForm>
        </details>
      )}
    </li>
  );
}

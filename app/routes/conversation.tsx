// A match's conversation, read from Stream. Opening it takes a reason, logged on both accounts with the
// staff member's email before a single message is fetched (admin_log, conversation.view), at every
// loading, older pages included.
import { Form, Link, useSearchParams } from "react-router";
import { ArrowUpIcon, CalendarIcon, LockIcon, Trash2Icon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { ScrollArea } from "~/components/ui/scroll-area";
import { ReasonDialog } from "~/components/app/act";
import { Nothing, Page, PageHeader, Panel, PersonAvatar, PersonLink, TimeAgo } from "~/components/app/bits";
import { formatDate } from "~/components/app/format";
import { staffContext } from "~/lib/context";
import { getConfig } from "~/lib/.server/config";
import { query, rpc } from "~/lib/.server/db";
import { demoMessages } from "~/lib/.server/demo-chat";
import { channelMessages, type ChatMessage } from "~/lib/.server/stream";
import type { MatchRow, Person } from "~/lib/types";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/conversation";

interface MatchDetail extends Omit<MatchRow, "sessions"> {
  sessions: { id: string; sport: string; status: string; chosenAt: string | null; proposer: string; title: string; note: string; createdAt: string }[];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const staff = context.get(staffContext);
  const url = new URL(request.url);
  const reason = url.searchParams.get("reason")?.trim() ?? "";
  const match = await query<MatchDetail | null>(staff, "admin_match", { p_match: params.id });
  if (!match) return { match: null, reason, messages: null, error: null };
  if (!reason) return { match, reason, messages: null, error: null };

  await Promise.all(
    [match.a.id, match.b.id].map((user) =>
      rpc(staff, "admin_log", { p_action: "conversation.view", p_user: user, p_target: match.id, p_reason: reason }),
    ),
  );
  const config = getConfig();
  const demo = config.env === "local" && !config.stream ? demoMessages(match.a.id, match.b.id, config.demoMediaUrl) : null;
  if (demo) return { match, reason, messages: { exists: true, messages: demo, hasMore: false }, error: null };
  try {
    const messages = await channelMessages(match.id, 80, url.searchParams.get("before") ?? undefined);
    return { match, reason, messages, error: null };
  } catch (error) {
    return { match, reason, messages: null, error: error instanceof Error ? error.message : "Stream didn't answer." };
  }
}

export const handle = {
  crumb: (data: unknown) => {
    const m = (data as { match?: MatchDetail | null } | undefined)?.match;
    return m ? `${m.a.name || "?"} and ${m.b.name || "?"}` : "Conversation";
  },
};

export default function Conversation({ loaderData: { match, reason, messages, error } }: Route.ComponentProps) {
  const [params] = useSearchParams();
  if (!match) {
    return (
      <Page>
        <Nothing title="No such match" />
      </Page>
    );
  }
  const people: Record<string, Person> = { [match.a.id]: match.a, [match.b.id]: match.b };

  return (
    <Page>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <PersonLink person={match.a} /> <span className="text-base font-normal text-muted-foreground">and</span>{" "}
            <PersonLink person={match.b} />
          </span>
        }
        description={
          <>
            Matched <TimeAgo value={match.createdAt} exact />
            {match.endedAt && (
              <>
                , ended <TimeAgo value={match.endedAt} exact /> by {people[match.endedBy ?? ""]?.name ?? "one of them"}
              </>
            )}
          </>
        }
      />

      {!messages && !error ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockIcon className="size-4" />
              Private messages
            </CardTitle>
            <CardDescription>
              Reading them is logged with your email and this reason, on both accounts' staff trail.
            </CardDescription>
          </CardHeader>
          <Form method="get">
            <CardContent>
              <Field>
                <FieldLabel htmlFor="reason">Why are you opening this conversation?</FieldLabel>
                <Input id="reason" name="reason" required autoFocus defaultValue={params.get("suggest") ?? ""} maxLength={300} placeholder="Report, hold, investigation" />
                <FieldDescription>Every page of messages you load is logged.</FieldDescription>
              </Field>
            </CardContent>
            <CardFooter className="mt-6 justify-end">
              <Button type="submit">Open the conversation</Button>
            </CardFooter>
          </Form>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Panel title="Messages" description={<>Opened for: {reason}</>} contentClassName="px-0">
            {error ? (
              <div className="px-6">
                <Alert variant="destructive">
                  <AlertTitle>Stream couldn't be read</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            ) : !messages?.exists ? (
              <Nothing title="Nobody wrote yet">The chat channel is created with the first message.</Nothing>
            ) : messages.messages.length === 0 ? (
              <Nothing title="No message" />
            ) : (
              <ScrollArea className="h-[min(70vh,48rem)] px-6">
                {messages.hasMore && (
                  <div className="mb-4 flex justify-center">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`?${new URLSearchParams({ reason, before: messages.messages[0].id })}`} preventScrollReset>
                        <ArrowUpIcon data-icon="inline-start" />
                        Older messages
                      </Link>
                    </Button>
                  </div>
                )}
                <ol className="space-y-3 pb-4">
                  {messages.messages.map((m) => (
                    <Bubble key={m.id} message={m} author={people[m.user?.id ?? ""]} left={m.user?.id === match.a.id} matchId={match.id} />
                  ))}
                </ol>
                {params.get("before") && (
                  <div className="flex justify-center pb-4">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`?${new URLSearchParams({ reason })}`}>Latest messages</Link>
                    </Button>
                  </div>
                )}
              </ScrollArea>
            )}
          </Panel>
          <Panel title="Sessions" className="self-start">
            {match.sessions.length === 0 ? (
              <Nothing icon={<CalendarIcon />} title="None proposed" />
            ) : (
              <ItemGroup className="gap-1">
                {match.sessions.map((s) => (
                  <Item key={s.id} size="sm" className="px-0">
                    <ItemContent>
                      <ItemTitle>
                        <Badge variant={s.status === "accepted" ? "default" : "secondary"} className="capitalize">
                          {s.status}
                        </Badge>
                        {s.title || s.sport}
                      </ItemTitle>
                      <ItemDescription>
                        {people[s.proposer]?.name ?? "Someone"} proposed, {s.chosenAt ? formatDate(s.chosenAt) : <TimeAgo value={s.createdAt} />}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </Panel>
        </div>
      )}
    </Page>
  );
}

/** Attachment links come from the sender's client: only web addresses. */
function safe(url: string | undefined) {
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}

const standardKeys = new Set([
  "id", "text", "html", "type", "user", "created_at", "updated_at", "deleted_at", "attachments", "latest_reactions",
  "own_reactions", "reaction_counts", "reaction_scores", "reaction_groups", "reply_count", "deleted_reply_count", "cid",
  "mentioned_users", "silent", "pinned", "pinned_at", "pinned_by", "pin_expires", "shadowed", "status", "quoted_message_id",
  "quoted_message", "i18n", "restricted_visibility", "member", "channel_cid",
]);

function Bubble({ message: m, author, left, matchId }: { message: ChatMessage; author?: Person; left: boolean; matchId: string }) {
  const deleted = m.type === "deleted" || Boolean(m.deleted_at);
  const custom = Object.fromEntries(Object.entries(m).filter(([k]) => !standardKeys.has(k)));
  if (m.type === "system" || !m.user) {
    return <li className="text-center text-xs text-muted-foreground">{m.text || JSON.stringify(custom)}</li>;
  }
  return (
    <li className={cn("group flex items-end gap-2", !left && "flex-row-reverse")}>
      <PersonAvatar person={author ?? { name: m.user.name, photo: null }} className="size-7" />
      <div className={cn("flex max-w-[75%] flex-col gap-1", left ? "items-start" : "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm",
            deleted ? "border border-dashed text-muted-foreground italic" : left ? "rounded-bl-md bg-muted" : "rounded-br-md bg-primary text-primary-foreground",
          )}
        >
          {deleted && <span className="text-xs">Deleted message</span>}
          {m.quoted_message_id && <div className="mb-1 text-xs opacity-70">Replying to a message</div>}
          {m.text && <p className="break-words whitespace-pre-wrap">{m.text}</p>}
          {m.attachments?.map((a, i) =>
            safe(a.image_url) || safe(a.thumb_url) ? (
              <a key={i} href={safe(a.image_url) ?? safe(a.thumb_url)} target="_blank" rel="noreferrer noopener">
                <img src={safe(a.thumb_url) ?? safe(a.image_url)} alt="" referrerPolicy="no-referrer" loading="lazy" className="mt-1 max-h-64 rounded-lg" />
              </a>
            ) : safe(a.asset_url) ? (
              <a key={i} href={safe(a.asset_url)} target="_blank" rel="noreferrer noopener" className="mt-1 block underline">
                {a.title || a.type || "Attachment"}
              </a>
            ) : null,
          )}
          {Object.keys(custom).length > 0 && <pre className="mt-1 overflow-x-auto font-mono text-[11px] opacity-80">{JSON.stringify(custom, null, 1)}</pre>}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <TimeAgo value={m.created_at} exact />
          {m.latest_reactions && m.latest_reactions.length > 0 && <span>{m.latest_reactions.map((r) => r.type).join(" ")}</span>}
          {!deleted && (
            <ReasonDialog
              intent="delete-message"
              fields={{ match: matchId, message: m.id, user: m.user.id }}
              destructive
              title="Delete this message?"
              description="It shows as deleted to both people."
              submit="Delete"
              trigger={
                <Button variant="ghost" size="icon-xs" className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" aria-label="Delete message">
                  <Trash2Icon />
                </Button>
              }
            />
          )}
        </div>
      </div>
    </li>
  );
}

// A match's conversation in a drawer, readable at once. Opening it is logged on both accounts' trail
// with where it was opened from (conversation-data).
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { ArrowUpIcon, CalendarIcon, Trash2Icon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import type { ChatMessage } from "~/lib/.server/stream";
import type { Person } from "~/lib/types";
import { cn } from "~/lib/utils";
import type { ConversationData } from "~/routes/conversation-data";
import { ReasonDialog } from "./act";
import { Nothing, PersonAvatar, PersonLink, TimeAgo } from "./bits";
import { formatDate } from "./format";
import { PhotoViewer } from "./photo-viewer";

export function ConversationDrawer({ matchId, from, onClose }: { matchId: string | null; from: string; onClose: () => void }) {
  return (
    <Sheet open={!!matchId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 sm:max-w-2xl">
        {/* Keyed by match: another conversation starts from a clean slate. */}
        {matchId && <Conversation key={matchId} matchId={matchId} from={from} />}
      </SheetContent>
    </Sheet>
  );
}

function Conversation({ matchId, from }: { matchId: string; from: string }) {
  const fetcher = useFetcher<ConversationData>();
  const [older, setOlder] = useState<{ messages: ChatMessage[]; hasMore: boolean } | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  useEffect(() => {
    fetcher.load(`/conversation-data/${matchId}?from=${encodeURIComponent(from)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per match: the component is keyed by it
  }, []);

  const data = fetcher.data?.match.id === matchId ? fetcher.data : undefined;
  const messages = data?.messages ? [...(older?.messages ?? []), ...data.messages.messages] : [];
  const hasMore = older ? older.hasMore : (data?.messages?.hasMore ?? false);
  const people: Record<string, Person> = data ? { [data.match.a.id]: data.match.a, [data.match.b.id]: data.match.b } : {};

  const loadOlder = async () => {
    setLoadingOlder(true);
    try {
      const res = await fetch(
        `/conversation-data/${matchId}?from=${encodeURIComponent(`${from}, older messages`)}&before=${messages[0].id}`,
      );
      const page = (await res.json()) as ConversationData;
      setOlder((o) => ({
        messages: [...(page.messages?.messages ?? []), ...(o?.messages ?? [])],
        hasMore: page.messages?.hasMore ?? false,
      }));
    } finally {
      setLoadingOlder(false);
    }
  };

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="flex flex-wrap items-center gap-2">
          {data ? (
            <>
              <PersonLink person={data.match.a} />
              <span className="font-normal text-muted-foreground">and</span>
              <PersonLink person={data.match.b} />
            </>
          ) : (
            <Skeleton className="h-6 w-56" />
          )}
        </SheetTitle>
        <SheetDescription>
          {data ? (
            <>
              Matched <TimeAgo value={data.match.createdAt} exact />
              {data.match.endedAt && (
                <>
                  , ended <TimeAgo value={data.match.endedAt} /> by {people[data.match.endedBy ?? ""]?.name ?? "one of them"}
                </>
              )}
              . Reading it is logged on both accounts.
            </>
          ) : (
            "Loading"
          )}
        </SheetDescription>
        {data && data.match.sessions.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="mt-2 w-fit">
                <CalendarIcon data-icon="inline-start" />
                {data.match.sessions.length} session{data.match.sessions.length > 1 ? "s" : ""}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ItemGroup className="mt-2 gap-1">
                {data.match.sessions.map((s) => (
                  <Item key={s.id} size="sm" variant="muted">
                    <ItemContent>
                      <ItemTitle>
                        <Badge variant={s.status === "accepted" ? "default" : "secondary"} className="capitalize">
                          {s.status}
                        </Badge>
                        {s.title || s.sport}
                      </ItemTitle>
                      <ItemDescription>
                        {people[s.proposer]?.name ?? "Someone"} proposed,{" "}
                        {s.chosenAt ? formatDate(s.chosenAt) : <TimeAgo value={s.createdAt} />}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            </CollapsibleContent>
          </Collapsible>
        )}
      </SheetHeader>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          {!data ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className={cn("h-12 w-2/3 rounded-2xl", i % 2 && "ml-auto")} />
              ))}
            </div>
          ) : data.error ? (
            <Alert variant="destructive">
              <AlertTitle>Stream couldn't be read</AlertTitle>
              <AlertDescription>{data.error}</AlertDescription>
            </Alert>
          ) : !data.messages?.exists ? (
            <Nothing title="Nobody wrote yet">The chat channel is created with the first message.</Nothing>
          ) : messages.length === 0 ? (
            <Nothing title="No message" />
          ) : (
            <>
              {hasMore && (
                <div className="mb-4 flex justify-center">
                  <Button variant="outline" size="sm" disabled={loadingOlder} onClick={loadOlder}>
                    <ArrowUpIcon data-icon="inline-start" />
                    Older messages
                  </Button>
                </div>
              )}
              <ol className="space-y-3">
                {messages.map((m) => (
                  <Bubble
                    key={m.id}
                    message={m}
                    author={people[m.user?.id ?? ""]}
                    left={m.user?.id === data.match.a.id}
                    matchId={data.match.id}
                  />
                ))}
              </ol>
            </>
          )}
        </div>
      </ScrollArea>
    </>
  );
}

/** A photo sent in the chat; it opens large in a dialog. */
function ChatImage({ thumb, full, author }: { thumb: string; full: string; author?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 block cursor-zoom-in overflow-hidden rounded-lg"
        aria-label="Open the photo larger"
      >
        <img src={thumb} alt="" referrerPolicy="no-referrer" loading="lazy" className="max-h-64" />
      </button>
      <PhotoViewer
        items={[{ key: full, src: full, caption: author ? `Sent by ${author}` : undefined }]}
        index={0}
        open={open}
        onOpenChange={setOpen}
        title="Photo sent in the chat"
      />
    </>
  );
}

/** Attachment links come from the sender's client: only web addresses. */
function safe(url: string | undefined) {
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}

const standardKeys = new Set([
  "id",
  "text",
  "html",
  "type",
  "user",
  "created_at",
  "updated_at",
  "deleted_at",
  "attachments",
  "latest_reactions",
  "own_reactions",
  "reaction_counts",
  "reaction_scores",
  "reaction_groups",
  "reply_count",
  "deleted_reply_count",
  "cid",
  "mentioned_users",
  "silent",
  "pinned",
  "pinned_at",
  "pinned_by",
  "pin_expires",
  "shadowed",
  "status",
  "quoted_message_id",
  "quoted_message",
  "i18n",
  "restricted_visibility",
  "member",
  "channel_cid",
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
            deleted
              ? "border border-dashed text-muted-foreground italic"
              : left
                ? "rounded-bl-md bg-muted"
                : "rounded-br-md bg-primary text-primary-foreground",
          )}
        >
          {deleted && <span className="text-xs">Deleted message</span>}
          {m.quoted_message_id && <div className="mb-1 text-xs opacity-70">Replying to a message</div>}
          {m.text && <p className="break-words whitespace-pre-wrap">{m.text}</p>}
          {m.attachments?.map((a, i) =>
            safe(a.image_url) || safe(a.thumb_url) ? (
              <ChatImage
                key={i}
                thumb={(safe(a.thumb_url) ?? safe(a.image_url))!}
                full={(safe(a.image_url) ?? safe(a.thumb_url))!}
                author={author?.name}
              />
            ) : safe(a.asset_url) ? (
              <a key={i} href={safe(a.asset_url)} target="_blank" rel="noreferrer noopener" className="mt-1 block underline">
                {a.title || a.type || "Attachment"}
              </a>
            ) : null,
          )}
          {Object.keys(custom).length > 0 && (
            <pre className="mt-1 overflow-x-auto font-mono text-[11px] opacity-80">{JSON.stringify(custom, null, 1)}</pre>
          )}
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
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Delete message"
                >
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

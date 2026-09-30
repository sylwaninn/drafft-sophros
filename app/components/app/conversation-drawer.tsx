// A match's conversation in a drawer. It opens on why it may be read (its basis: a report, a help
// request, a hold) and a reason the person types; only then are the messages read, the reading logged on
// both accounts' trail with the reason and where it was opened from (conversation-data). Without a
// basis, only an admin reads it, as an override confirmed apart with why (a legal request or members'
// safety).
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { ArrowUpIcon, CalendarIcon, MessagesSquareIcon, ShieldAlertIcon, Trash2Icon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import type { ChatMessage } from "~/lib/.server/stream";
import { olderMessages } from "~/lib/older-messages";
import { basisLabels, isOverrideBasis, overrideBases, READ_REASON_MAX, type ConversationAccess, type OverrideBasis } from "~/lib/reasons";
import type { Person } from "~/lib/types";
import { cn } from "~/lib/utils";
import type { ConversationGate, ConversationPage, ConversationRead } from "~/routes/conversation-data";
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
  const gate = useFetcher<ConversationGate>();
  const reading = useFetcher<ConversationRead>();
  // Typed here, not in the gate: a refused reading gives the gate back with the reason still in it.
  const [reason, setReason] = useState("");
  // What the reading was asked with: the older pages are asked (and logged) with it too.
  const [asked, setAsked] = useState<Asked | null>(null);
  const [older, setOlder] = useState<ConversationPage | null>(null);
  // Deleted from here: shown as deleted at once, without reading the conversation again.
  const [deleted, setDeleted] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    gate.load(`/conversation-data/${matchId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per match: the component is keyed by it
  }, []);

  // No basis any more (a hold lifted, a request closed since the drawer opened): the basis shown is
  // stale, so it's asked again, with the override an admin may now need.
  useEffect(() => {
    if (reading.state === "idle" && reading.data && !reading.data.ok && reading.data.code === "no_basis") {
      gate.load(`/conversation-data/${matchId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on each answer only
  }, [reading.state, reading.data]);

  const info = gate.data?.match.id === matchId ? gate.data : undefined;
  const read = reading.data?.ok ? reading.data : undefined;
  const refusal = reading.data && !reading.data.ok ? reading.data : undefined;
  const page = read?.messages ?? null;
  const messages = page ? [...(older?.messages ?? []), ...page.messages] : [];
  const hasMore = older ? older.hasMore : (page?.hasMore ?? false);
  const people: Record<string, Person> = info ? { [info.match.a.id]: info.match.a, [info.match.b.id]: info.match.b } : {};

  const open = (override: OverrideBasis | null) => {
    const typed = reason.trim();
    if (!typed) return;
    const next = { reason: typed, overrideBasis: override };
    setAsked(next);
    // Nothing else on the page reloads: no other read is logged.
    reading.submit(readFields(next, from), { method: "post", action: `/conversation-data/${matchId}`, defaultShouldRevalidate: false });
  };

  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadOlder = async () => {
    if (!asked || !messages.length) return;
    setLoadingOlder(true);
    try {
      // Logged like the first page, with the same reason (a plain request: nothing else reloads).
      const res = await fetch(`/conversation-data/${matchId}`, {
        method: "POST",
        body: new URLSearchParams({ ...readFields(asked, `${from}, older messages`), before: messages[0].id }),
      });
      const answer = await olderMessages(res);
      if (!answer.ok) return void toast.error(answer.error);
      setOlder((o) => ({
        exists: true,
        messages: [...answer.page.messages, ...(o?.messages ?? [])],
        hasMore: answer.page.hasMore,
      }));
    } catch (error) {
      console.error("older messages", error);
      toast.error("The older messages couldn't be read.");
    } finally {
      setLoadingOlder(false);
    }
  };

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="flex flex-wrap items-center gap-2">
          {info ? (
            <>
              <PersonLink person={info.match.a} />
              <span className="font-normal text-muted-foreground">and</span>
              <PersonLink person={info.match.b} />
            </>
          ) : (
            <Skeleton className="h-6 w-56" />
          )}
        </SheetTitle>
        <SheetDescription>
          {info ? (
            <>
              Matched <TimeAgo value={info.match.createdAt} exact />
              {info.match.endedAt && (
                <>
                  , ended <TimeAgo value={info.match.endedAt} /> by {people[info.match.endedBy ?? ""]?.name ?? "one of them"}
                </>
              )}
              . Reading it is logged on both accounts, with your reason.
            </>
          ) : (
            "Loading"
          )}
        </SheetDescription>
        {info && <BasisBadges access={info.access} override={read ? (asked?.overrideBasis ?? null) : null} />}
        {info && info.match.sessions.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="mt-2 w-fit">
                <CalendarIcon data-icon="inline-start" />
                {info.match.sessions.length} session{info.match.sessions.length > 1 ? "s" : ""}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ItemGroup className="mt-2 gap-1">
                {info.match.sessions.map((s) => (
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
          {!info ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className={cn("h-12 w-2/3 rounded-2xl", i % 2 && "ml-auto")} />
              ))}
            </div>
          ) : !read ? (
            // Stays mounted while the reading is asked: a refusal gives it back as it was typed.
            <ReadGate
              access={info.access}
              refusal={reading.state === "idle" ? (refusal?.error ?? null) : null}
              pending={reading.state !== "idle"}
              reason={reason}
              onReason={setReason}
              onOpen={open}
            />
          ) : !read.messages ? (
            <Alert variant="destructive">
              <AlertTitle>Stream couldn't be read</AlertTitle>
              <AlertDescription>{read.streamError}</AlertDescription>
            </Alert>
          ) : !read.messages.exists ? (
            <Nothing title="Nobody wrote yet">The chat channel is created with the first message.</Nothing>
          ) : messages.length === 0 ? (
            <Nothing title="No message" />
          ) : (
            <>
              {hasMore && (
                <div className="mb-4 flex justify-center">
                  <Button variant="outline" size="sm" disabled={loadingOlder} onClick={loadOlder}>
                    {loadingOlder ? <Spinner data-icon="inline-start" /> : <ArrowUpIcon data-icon="inline-start" />}
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
                    left={m.user?.id === info.match.a.id}
                    matchId={info.match.id}
                    overrideBasis={asked?.overrideBasis ?? null}
                    deletedHere={deleted.has(m.id)}
                    onDeleted={() => setDeleted((d) => new Set(d).add(m.id))}
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

/** What a reading was asked with: the reason, and why an admin read it without a basis (null: it had one). */
interface Asked {
  reason: string;
  overrideBasis: OverrideBasis | null;
}

/** A reading as conversation-data takes it, from where it was opened. */
function readFields(asked: Asked, from: string): Record<string, string> {
  return {
    reason: asked.reason,
    from,
    override: String(asked.overrideBasis !== null),
    override_basis: asked.overrideBasis ?? "",
  };
}

/** Why the team may read it, as the database sees it; or the override it was opened with. */
function BasisBadges({ access, override }: { access: ConversationAccess; override: OverrideBasis | null }) {
  if (access.basis.length === 0) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Badge variant={override ? "destructive" : "outline"}>
          {override ? `Read as an admin override: ${overrideBases[override].title.toLowerCase()}` : "No basis"}
        </Badge>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {access.basis.map((b) => (
        <Tooltip key={b}>
          <TooltipTrigger asChild>
            <Badge variant="secondary" tabIndex={0}>
              {basisLabels[b].title}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{basisLabels[b].description}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

/**
 * Before any message: the reason, typed by the person, for the audit log. Without a basis (no report,
 * help request or hold), a moderator can't read it; an admin can, as an override confirmed apart, saying
 * why: a legal request or members' safety.
 */
function ReadGate({
  access,
  refusal,
  pending,
  reason,
  onReason,
  onOpen,
}: {
  access: ConversationAccess;
  refusal: string | null;
  pending: boolean;
  reason: string;
  onReason: (reason: string) => void;
  onOpen: (override: OverrideBasis | null) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [overrideBasis, setOverrideBasis] = useState<OverrideBasis | null>(null);
  const typed = reason.trim();
  const basis = access.basis.length > 0;
  const ReadIcon = basis ? MessagesSquareIcon : ShieldAlertIcon;
  const submit = () => {
    if (!typed || pending) return;
    if (basis) onOpen(null);
    else if (access.canOverride) setConfirming(true);
  };
  return (
    <div className="mx-auto grid max-w-lg gap-6 py-6">
      {basis ? (
        <Alert>
          <MessagesSquareIcon />
          <AlertTitle>Private until you say why</AlertTitle>
          <AlertDescription>
            <p>Members are told the team reads a chat only for a report, a help request or a risk to their safety. This one has a basis:</p>
            <ul className="mt-1 list-disc pl-4">
              {access.basis.map((b) => (
                <li key={b}>{basisLabels[b].description}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <ShieldAlertIcon />
          <AlertTitle>No basis to read it</AlertTitle>
          <AlertDescription>
            No report between them, no help request from either in the last 90 days, and neither account is on hold by someone else.{" "}
            {access.canOverride
              ? "As an admin you can still read it, for a legal request or members' safety: it's logged as an override."
              : "Only an admin can read it, as an override."}
          </AlertDescription>
        </Alert>
      )}
      {(basis || access.canOverride) && (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Field data-invalid={refusal ? true : undefined}>
            <FieldLabel htmlFor="conversation-reason">Why you're reading it</FieldLabel>
            <Textarea
              id="conversation-reason"
              required
              rows={3}
              maxLength={READ_REASON_MAX}
              value={reason}
              onChange={(e) => onReason(e.target.value)}
              placeholder={basis ? "Checking the insults the report describes" : "What the request or the risk is"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            {refusal ? (
              <FieldError>{refusal}</FieldError>
            ) : (
              <FieldDescription>Saved with your email on both accounts' trail, with where you opened it from.</FieldDescription>
            )}
          </Field>
          <Button type="submit" variant={basis ? "default" : "destructive"} disabled={!typed || pending} className="w-fit">
            {pending ? <Spinner data-icon="inline-start" /> : <ReadIcon data-icon="inline-start" />}
            {basis ? "Read the conversation" : "Read without a basis"}
          </Button>
        </form>
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Read it without a basis?</AlertDialogTitle>
            <AlertDialogDescription>
              Nothing on record allows it. It's logged on both accounts as an admin override, with why and your reason: “{typed}”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel id="override-basis-label">Why without a basis</FieldLabel>
            <RadioGroup
              aria-labelledby="override-basis-label"
              value={overrideBasis ?? ""}
              onValueChange={(value) => setOverrideBasis(isOverrideBasis(value) ? value : null)}
            >
              {(Object.keys(overrideBases) as OverrideBasis[]).map((b) => (
                <Field key={b} orientation="horizontal">
                  <RadioGroupItem value={b} id={`override-${b}`} />
                  <FieldLabel htmlFor={`override-${b}`} className="font-normal">
                    <span className="font-medium">{overrideBases[b].title}</span>
                    <span className="text-muted-foreground">{overrideBases[b].description}</span>
                  </FieldLabel>
                </Field>
              ))}
            </RadioGroup>
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={!overrideBasis} onClick={() => overrideBasis && onOpen(overrideBasis)}>
              Read it anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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

function Bubble({
  message: m,
  author,
  left,
  matchId,
  overrideBasis,
  deletedHere,
  onDeleted,
}: {
  message: ChatMessage;
  author?: Person;
  left: boolean;
  matchId: string;
  /** Opened as an admin override (and why): deleting a message in it is one too. */
  overrideBasis: OverrideBasis | null;
  deletedHere: boolean;
  onDeleted: () => void;
}) {
  const deleted = m.type === "deleted" || Boolean(m.deleted_at) || deletedHere;
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
              fields={{
                match: matchId,
                message: m.id,
                user: m.user.id,
                override: overrideBasis ? "true" : "",
                override_basis: overrideBasis ?? "",
              }}
              destructive
              statement={{}}
              onDone={onDeleted}
              title="Delete this message?"
              description={`It shows as deleted to both people, and ${author?.name || "its author"} is told why.`}
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

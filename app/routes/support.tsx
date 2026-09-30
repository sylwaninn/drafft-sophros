import { useEffect, useId, useRef, useState } from "react";
import { Form, Link, useFetcher, useNavigate, useRevalidator, useSearchParams } from "react-router";
import {
  ArrowRightIcon,
  CheckIcon,
  DownloadIcon,
  LifeBuoyIcon,
  MailCheckIcon,
  RotateCcwIcon,
  SearchIcon,
  SendIcon,
  UserXIcon,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "~/components/ui/item";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
import { Label } from "~/components/ui/label";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { Card } from "~/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { ActButton, useAct } from "~/components/app/act";
import { useRoot } from "~/components/app/root-data";
import { Facts, Id, Nothing, Page, PageHeader, PersonLink, TimeAgo } from "~/components/app/bits";
import { staffContext } from "~/lib/context";
import { deletionLink } from "~/lib/deletion";
import { query } from "~/lib/.server/db";
import type { DataRequest, SupportRequest } from "~/lib/types";
import type { Route } from "./+types/support";

export async function loader({ request, context }: Route.LoaderArgs) {
  const staff = context.get(staffContext);
  const url = new URL(request.url);
  const open = url.searchParams.get("status") !== "all";
  const [requests, exports] = await Promise.all([
    query<SupportRequest[]>(staff, "admin_support", { p_open: open, p_query: url.searchParams.get("q") ?? "", p_limit: 100 }),
    query<DataRequest[]>(staff, "admin_data_requests", { p_open: open }),
  ]);
  return { requests, exports };
}

export default function Support({ loaderData: { requests, exports } }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<number | null>(null);
  // A request closed while open leaves the "Open" list; the sheet keeps showing it until dismissed,
  // read on its own (by reference, any status) so the reply just sent and the new status show. The
  // fetcher is revalidated with the page, after each change and while a reply is being emailed.
  const [snapshot, setSnapshot] = useState<SupportRequest | null>(null);
  const detached = useFetcher<typeof loader>();
  const detachedFor = useRef<number | null>(null);
  const open = (r: SupportRequest) => {
    setSnapshot(r);
    setOpenId(r.id);
  };
  const tab = params.get("tab") ?? "requests";
  const all = params.get("status") === "all";
  const q = params.get("q") ?? "";
  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    navigate(`?${next}`, { replace: true, preventScrollReset: true });
  };
  const listed = openId === null ? undefined : requests.find((r) => r.id === openId);
  const detachedCopy = openId === null ? undefined : detached.data?.requests.find((r) => r.id === openId);
  const selected = openId === null ? null : (listed ?? detachedCopy ?? (snapshot?.id === openId ? snapshot : null));
  const reference = openId !== null && !listed && snapshot?.id === openId ? snapshot.reference : null;
  useEffect(() => {
    if (openId === null || reference === null || detachedFor.current === openId) return;
    detachedFor.current = openId;
    detached.load(`/support?${new URLSearchParams({ status: "all", q: reference })}`);
  }, [openId, reference, detached]);

  return (
    <Page>
      <PageHeader
        title="Support"
        description="Messages from the app's help forms, and data exports to send. Open a request to reply: the email leaves from here, in their language."
        actions={
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={all ? "all" : "open"}
            onValueChange={(v) => v && set({ status: v === "all" ? "all" : null })}
          >
            <ToggleGroupItem value="open">Open</ToggleGroupItem>
            <ToggleGroupItem value="all">All</ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <Tabs value={tab} onValueChange={(t) => set({ tab: t === "requests" ? null : t })}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="requests">
              <LifeBuoyIcon />
              Requests
              <Badge variant="secondary">{requests.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="exports">
              <DownloadIcon />
              Data exports
              <Badge variant="secondary">{exports.length}</Badge>
            </TabsTrigger>
          </TabsList>
          {tab === "requests" && (
            <Form method="get" className="w-full sm:w-72">
              {all && <input type="hidden" name="status" value="all" />}
              <InputGroup>
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput name="q" type="search" defaultValue={q} placeholder="Reference, email or words" />
              </InputGroup>
            </Form>
          )}
        </div>

        <TabsContent value="requests" className="mt-4">
          {requests.length === 0 ? (
            <Nothing title={q ? "Nothing matches" : "Inbox zero"}>
              {q ? "Try another reference or email." : "Every request has been handled."}
            </Nothing>
          ) : (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Reference</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-4 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((s) => (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => open(s)}>
                      <TableCell className="pl-4 font-mono text-xs">{s.reference}</TableCell>
                      <TableCell className="font-medium">{s.topic}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {s.person ? <PersonLink person={s.person} /> : <span className="text-muted-foreground">{s.email}</span>}
                      </TableCell>
                      <TableCell className="max-w-80 truncate text-muted-foreground">
                        {s.replies.length > 0 && (
                          <Badge variant="outline" className="mr-2">
                            {s.replies.length} repl{s.replies.length === 1 ? "y" : "ies"}
                          </Badge>
                        )}
                        {s.message}
                      </TableCell>
                      <TableCell>
                        <TimeAgo value={s.created_at} />
                      </TableCell>
                      <TableCell>{s.handled_at ? <Badge variant="outline">Handled</Badge> : <Badge>Open</Badge>}</TableCell>
                      <TableCell className="pr-4 text-right">
                        {/* The row opens on a click; this is its keyboard way in. */}
                        <Button variant="ghost" size="sm" onClick={() => open(s)}>
                          Open
                          <span className="sr-only">request {s.reference}</span>
                          <ArrowRightIcon data-icon="inline-end" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="exports" className="mt-4">
          {exports.length === 0 ? (
            <Nothing title="No export to send" />
          ) : (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Account</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Asked</TableHead>
                    <TableHead className="pr-4 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exports.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="pl-4">
                        <PersonLink person={d.person} />
                      </TableCell>
                      <TableCell>{d.email}</TableCell>
                      <TableCell>
                        <TimeAgo value={d.created_at} />
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        {d.fulfilled_at ? (
                          <Badge variant="outline">Sent by {d.fulfilled_by}</Badge>
                        ) : (
                          <ActButton intent="data-request" fields={{ id: d.id }} size="sm">
                            <CheckIcon data-icon="inline-start" />
                            Mark sent
                          </ActButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setOpenId(null)}>
        <SheetContent className="gap-0 sm:max-w-xl">{selected && <Thread request={selected} />}</SheetContent>
      </Sheet>
    </Page>
  );
}

/** A request, the team's replies under it, and the reply box: sent by email from the backend. */
function Thread({ request: r }: { request: SupportRequest }) {
  const { staff } = useRoot();
  const deleteLink = deletionLink(staff, r);
  const form = useRef<HTMLFormElement>(null);
  const formId = useId();
  const [close, setClose] = useState(true);
  // One key per reply, made in the browser when the reply box is first used (never during server
  // rendering) and dropped once it's sent: sending the same reply twice (a double press, a retried
  // request) is one message and one email (admin_reply_support). Another request, another key.
  const [replyKey, setReplyKey] = useState<{ request: number; key: string } | null>(null);
  const key = replyKey?.request === r.id ? replyKey.key : "";
  const ensureKey = () => {
    if (!key) setReplyKey({ request: r.id, key: crypto.randomUUID() });
  };
  const { fetcher, pending } = useAct({
    onDone: () => {
      form.current?.reset();
      setReplyKey(null);
    },
  });
  // A reply is emailed by the backend a moment later: check back until it's sent.
  const revalidator = useRevalidator();
  const sending = r.replies.some((m) => !m.sentAt && !m.error);
  useEffect(() => {
    if (!sending) return;
    const t = setInterval(() => revalidator.state === "idle" && revalidator.revalidate(), 3000);
    return () => clearInterval(t);
  }, [sending, revalidator]);
  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>{r.topic}</SheetTitle>
        <SheetDescription>
          <Id value={r.reference} />, {r.email}, <span className="uppercase">{r.language}</span>
        </SheetDescription>
      </SheetHeader>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 p-4">
          <Facts
            rows={[
              ["From", r.person ? <PersonLink key="p" person={r.person} /> : "Signed out"],
              ["Received", <TimeAgo key="t" value={r.created_at} exact />],
              ...Object.entries(r.context ?? {}).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)] as [string, string]),
              ["Status", r.handled_at ? `Handled by ${r.handled_by}` : "Open"],
            ]}
          />
          {/* A member asking to delete their account: an admin checks it's them, then deletes it from the account's
              page with this request as its reference. */}
          {deleteLink && (
            <Button variant="outline" size="sm" asChild>
              <Link to={deleteLink} viewTransition>
                <UserXIcon data-icon="inline-start" />
                Delete this account at their request
              </Link>
            </Button>
          )}
          <ItemGroup className="gap-3">
            <Item variant="muted" className="items-start">
              <ItemContent>
                <ItemDescription>
                  {r.person?.name || r.email}, <TimeAgo value={r.created_at} />
                </ItemDescription>
                <ItemTitle className="font-normal whitespace-pre-wrap">{r.message}</ItemTitle>
              </ItemContent>
            </Item>
            {r.replies.map((m) => (
              <Item key={m.id} variant="outline" className="ml-8 items-start">
                <ItemContent>
                  <ItemDescription className="flex flex-wrap items-center gap-1.5">
                    {m.author}, <TimeAgo value={m.createdAt} />
                    {m.error ? (
                      <Badge variant="destructive">Not sent, retrying</Badge>
                    ) : m.sentAt ? (
                      <Badge variant="secondary">
                        <MailCheckIcon data-icon="inline-start" />
                        Sent
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Spinner data-icon="inline-start" />
                        Sending
                      </Badge>
                    )}
                  </ItemDescription>
                  <ItemTitle className="font-normal whitespace-pre-wrap">{m.body}</ItemTitle>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </div>
      </ScrollArea>
      <SheetFooter className="gap-3 border-t">
        <fetcher.Form ref={form} id={formId} method="post" action="/act" className="grid gap-3">
          <input type="hidden" name="intent" value="support-reply" />
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="close" value={String(close)} />
          <input type="hidden" name="key" value={key} />
          <Field>
            <FieldLabel htmlFor="reply" className="sr-only">
              Reply
            </FieldLabel>
            <Textarea
              id="reply"
              name="body"
              required
              rows={4}
              maxLength={8000}
              placeholder={`Reply to ${r.person?.name || r.email}, in their language (${r.language.toUpperCase()})`}
              onFocus={ensureKey}
              onChange={ensureKey}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  // One reply per press: not while one is on its way, nor on a held-down key.
                  if (!pending && !e.repeat) form.current?.requestSubmit();
                }
              }}
            />
            <FieldDescription>
              Emailed to {r.email} with the reference, framed in their language. Their answer reaches the support inbox.
            </FieldDescription>
          </Field>
        </fetcher.Form>
        {/* Outside the reply form: each of these buttons is a form of its own. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Checkbox id="close" checked={close} onCheckedChange={(v) => setClose(v === true)} />
            <Label htmlFor="close" className="font-normal">
              Close the request
            </Label>
          </div>
          <div className="flex items-center gap-2">
            {r.handled_at && (
              <ActButton intent="support" fields={{ id: r.id, handled: "false" }} variant="ghost" size="sm">
                <RotateCcwIcon data-icon="inline-start" />
                Reopen
              </ActButton>
            )}
            {!r.handled_at && (
              <ActButton intent="support" fields={{ id: r.id, handled: "true" }} variant="ghost" size="sm">
                <CheckIcon data-icon="inline-start" />
                Close without replying
              </ActButton>
            )}
            <Button type="submit" form={formId} disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
              Send
              <KbdGroup className="ml-1">
                <Kbd>⌘</Kbd>
                <Kbd>↵</Kbd>
              </KbdGroup>
            </Button>
          </div>
        </div>
      </SheetFooter>
    </>
  );
}

import { useState } from "react";
import { Form, useNavigate, useSearchParams } from "react-router";
import { CheckIcon, DownloadIcon, LifeBuoyIcon, MailIcon, RotateCcwIcon, SearchIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { ActButton } from "~/components/app/act";
import { Facts, Id, Nothing, Page, PageHeader, PersonLink, TimeAgo } from "~/components/app/bits";
import { staffContext } from "~/lib/context";
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
  const selected = requests.find((r) => r.id === openId) ?? null;

  return (
    <Page>
      <PageHeader
        title="Support"
        description="Messages from the app's help forms, and data exports to send. Reply by email with the reference in the subject."
        actions={
          <ToggleGroup type="single" variant="outline" size="sm" value={all ? "all" : "open"} onValueChange={(v) => v && set({ status: v === "all" ? "all" : null })}>
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
            <Nothing title={q ? "Nothing matches" : "Inbox zero"}>{q ? "Try another reference or email." : "Every request has been handled."}</Nothing>
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
                    <TableHead className="pr-4 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((s) => (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => setOpenId(s.id)}>
                      <TableCell className="pl-4 font-mono text-xs">{s.reference}</TableCell>
                      <TableCell className="font-medium">{s.topic}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {s.person ? <PersonLink person={s.person} /> : <span className="text-muted-foreground">{s.email}</span>}
                      </TableCell>
                      <TableCell className="max-w-80 truncate text-muted-foreground">{s.message}</TableCell>
                      <TableCell>
                        <TimeAgo value={s.created_at} />
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        {s.handled_at ? <Badge variant="outline">Handled</Badge> : <Badge>Open</Badge>}
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
        <SheetContent className="sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.topic}</SheetTitle>
                <SheetDescription>
                  <Id value={selected.reference} />, received <TimeAgo value={selected.created_at} exact />
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-6 overflow-y-auto px-4">
                <Facts
                  rows={[
                    ["From", selected.person ? <PersonLink key="p" person={selected.person} /> : "Signed out"],
                    ["Email", selected.email],
                    ["Language", <Badge key="l" variant="secondary" className="uppercase">{selected.language}</Badge>],
                    ...Object.entries(selected.context ?? {}).map(
                      ([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)] as [string, string],
                    ),
                  ]}
                />
                <blockquote className="border-l-2 pl-4 text-sm whitespace-pre-wrap">{selected.message}</blockquote>
                {selected.handled_at && (
                  <p className="text-sm text-muted-foreground">
                    Handled by {selected.handled_by}, <TimeAgo value={selected.handled_at} />.
                  </p>
                )}
              </div>
              <SheetFooter className="flex-row">
                <Button variant="outline" className="flex-1" asChild>
                  <a href={`mailto:${selected.email}?subject=${encodeURIComponent(`[${selected.reference}] ${selected.topic}`)}`}>
                    <MailIcon data-icon="inline-start" />
                    Reply by email
                  </a>
                </Button>
                <ActButton
                  intent="support"
                  fields={{ id: selected.id, handled: selected.handled_at ? "false" : "true" }}
                  variant={selected.handled_at ? "outline" : "default"}
                  className="flex-1"
                >
                  {selected.handled_at ? <RotateCcwIcon data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
                  {selected.handled_at ? "Reopen" : "Mark handled"}
                </ActButton>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Page>
  );
}

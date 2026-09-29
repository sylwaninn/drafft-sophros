import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowRightIcon, MessagesSquareIcon, ShieldAlertIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Field, FieldLabel } from "~/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ReasonDialog } from "~/components/app/act";
import { ConversationDrawer } from "~/components/app/conversation-drawer";
import { Facts, Nothing, Page, PageHeader, PersonLink, TimeAgo } from "~/components/app/bits";
import { useRoot } from "~/components/app/root-data";
import { staffContext } from "~/lib/context";
import { can } from "~/lib/roles";
import { query } from "~/lib/.server/db";
import { suggestedCategory } from "~/lib/reasons";
import type { Hold, Report } from "~/lib/types";
import type { Route } from "./+types/reports";

export async function loader({ request, context }: Route.LoaderArgs) {
  const open = new URL(request.url).searchParams.get("status") !== "all";
  return { reports: await query<Report[]>(context.get(staffContext), "admin_reports", { p_open: open, p_limit: 100 }) };
}

export const reasons: Record<string, string> = {
  fake: "Fake profile",
  inappropriate_photos: "Inappropriate photos",
  harassment: "Harassment",
  spam: "Spam or scam",
  underage: "Underage",
  other: "Other",
};

export default function Reports({ loaderData: { reports } }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const all = params.get("status") === "all";
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = reports.find((r) => r.id === openId) ?? null;

  return (
    <Page>
      <PageHeader
        title="Reports"
        description="What members reported. Underage, or 3 reporters in 30 days, already put the account in review."
        actions={
          <Tabs value={all ? "all" : "open"} onValueChange={(v) => navigate(v === "all" ? "?status=all" : "?", { replace: true })}>
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      {reports.length === 0 ? (
        <Nothing title="No open report">Reports from the app land here.</Nothing>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Reason</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => setOpenId(r.id)}
                  data-state={openId === r.id ? "selected" : undefined}
                >
                  <TableCell className="pl-4">
                    <Badge variant={r.reason === "underage" ? "destructive" : "secondary"}>{reasons[r.reason] ?? r.reason}</Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <PersonLink person={r.reported} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <PersonLink person={r.reporter} showHold={false} />
                  </TableCell>
                  <TableCell className="max-w-72 truncate text-muted-foreground">{r.details}</TableCell>
                  <TableCell>
                    <TimeAgo value={r.createdAt} />
                  </TableCell>
                  <TableCell>
                    {r.handledAt ? (
                      <Badge variant="outline">Closed</Badge>
                    ) : (r.reportedCount30d ?? 0) > 1 ? (
                      <Badge variant="destructive">{r.reportedCount30d} reporters</Badge>
                    ) : (
                      <Badge>Open</Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {/* The row opens on a click; this is its keyboard way in. */}
                    <Button variant="ghost" size="sm" onClick={() => setOpenId(r.id)}>
                      Open
                      <span className="sr-only">the report on {r.reported?.name || "this account"}</span>
                      <ArrowRightIcon data-icon="inline-end" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {/* Keyed by report: the hold chosen for one report never carries over to the next. */}
      <ReportSheet key={selected?.id ?? "none"} report={selected} onClose={() => setOpenId(null)} />
    </Page>
  );
}

function ReportSheet({ report: r, onClose }: { report: Report | null; onClose: () => void }) {
  const { staff } = useRoot();
  const [hold, setHold] = useState("none");
  const [reading, setReading] = useState<string | null>(null);
  const moderator = can(staff, "moderator");
  const ban = hold === "banned";
  return (
    <>
      <ConversationDrawer matchId={reading} from={r ? `report ${r.id.slice(0, 8)}` : "report"} onClose={() => setReading(null)} />
      <Sheet open={!!r} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="sm:max-w-lg">
          {r && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ShieldAlertIcon className="size-4" />
                  {reasons[r.reason] ?? r.reason}
                </SheetTitle>
                <SheetDescription>
                  Received <TimeAgo value={r.createdAt} exact />
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-6 overflow-y-auto px-4">
                <Facts
                  rows={[
                    ["Reported", <PersonLink key="d" person={r.reported} />],
                    ["By", <PersonLink key="r" person={r.reporter} showHold={false} />],
                    ["Reporters, 30 days", String(r.reportedCount30d ?? 1)],
                  ]}
                />
                {r.details && <blockquote className="border-l-2 pl-4 text-sm whitespace-pre-wrap italic">{r.details}</blockquote>}
                {r.match && moderator && (
                  <Button variant="outline" onClick={() => setReading(r.match ?? null)}>
                    <MessagesSquareIcon data-icon="inline-start" />
                    Read their conversation
                  </Button>
                )}
                {r.handledAt && (
                  <Facts
                    rows={[
                      ["Closed", <TimeAgo key="c" value={r.handledAt} />],
                      ["By", r.handledBy],
                      ["Resolution", r.resolution],
                    ]}
                  />
                )}
              </div>
              {!r.handledAt && moderator && r.reported && (
                <SheetFooter className="gap-3">
                  <Field>
                    <FieldLabel htmlFor="report-hold">Hold on {r.reported.name ?? "the account"}</FieldLabel>
                    <Select value={hold} onValueChange={setHold}>
                      <SelectTrigger id="report-hold" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No hold</SelectItem>
                        <SelectItem value="review">Hold for review</SelectItem>
                        <SelectItem value="selfie">Ask for a selfie</SelectItem>
                        <SelectItem value="banned">Ban</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <ReasonDialog
                    key={hold}
                    intent="report"
                    fields={{ report: r.id, user: r.reported.id, hold: hold === "none" ? "" : hold }}
                    // A hold is told to them with its reason; closing alone tells nobody.
                    statement={hold === "none" ? undefined : { category: suggestedCategory(hold as Hold) }}
                    reasonName="resolution"
                    label="Resolution"
                    placeholder="What you found and did"
                    destructive={ban}
                    title={ban ? `Ban ${r.reported.name ?? "this account"} and close the report` : "Close the report"}
                    description={
                      ban
                        ? "The ban applies at once: the account closes for good, and its email, phone and sign-ins can't come back. They're told why."
                        : hold === "none"
                          ? "The resolution goes to the audit log. Nobody is told."
                          : "The hold applies at once, and they're told why. The resolution goes to the audit log."
                    }
                    submit={ban ? "Ban and close" : "Close the report"}
                    trigger={
                      <Button className="w-full" variant={ban ? "destructive" : "default"}>
                        {ban ? "Ban and close" : "Close the report"}
                      </Button>
                    }
                  />
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

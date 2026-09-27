import { Link, useSearchParams } from "react-router";
import { staffContext } from "~/lib/context";
import { can } from "~/lib/roles";
import { query } from "~/lib/.server/db";
import type { Report } from "~/lib/types";
import { ActForm, Button, inputClass } from "~/components/actions";
import { Badge, Card, Empty, Page, PersonLink, Tabs, Time, useRoot } from "~/components/ui";
import type { Route } from "./+types/reports";

export async function loader({ request, context }: Route.LoaderArgs) {
  const open = new URL(request.url).searchParams.get("status") !== "all";
  return { reports: await query<Report[]>(context.get(staffContext), "admin_reports", { p_open: open, p_limit: 100 }) };
}

const reasons: Record<string, string> = {
  fake: "Fake profile",
  inappropriate_photos: "Inappropriate photos",
  harassment: "Harassment",
  spam: "Spam or scam",
  underage: "Underage",
  other: "Other",
};

export default function Reports({ loaderData: { reports } }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const all = params.get("status") === "all";
  const { staff } = useRoot();
  return (
    <Page title="Reports" subtitle="What members reported. Underage, or 3 people in 30 days, already put the account in review.">
      <Tabs
        items={[
          { label: "Open", to: "?", active: !all },
          { label: "All", to: "?status=all", active: all },
        ]}
      />
      {reports.length === 0 ? (
        <Card>
          <Empty>No open report.</Empty>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Card key={r.id}>
              <div className="grid gap-4 md:grid-cols-[1fr_24rem]">
                <div className="min-w-0 space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.reason === "underage" ? "negative" : "warning"}>{reasons[r.reason] ?? r.reason}</Badge>
                    <Time value={r.createdAt} />
                    {(r.reportedCount30d ?? 0) > 1 && <Badge tone="negative">{r.reportedCount30d} people in 30 days</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-mute">Reported</span>
                    <PersonLink person={r.reported} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-mute">By</span>
                    <PersonLink person={r.reporter} size={22} />
                  </div>
                  {r.details && <p className="rounded-lg bg-soft p-3 whitespace-pre-wrap">{r.details}</p>}
                  {r.match && can(staff, "moderator") && (
                    <Link to={`/conversations/${r.match}?suggest=${encodeURIComponent(`report ${r.id.slice(0, 8)}`)}`} className="inline-block underline">
                      Read their conversation
                    </Link>
                  )}
                  {r.handledAt && (
                    <p className="text-xs text-mute">
                      Closed <Time value={r.handledAt} /> by {r.handledBy}: {r.resolution}
                    </p>
                  )}
                </div>
                {!r.handledAt && can(staff, "moderator") && r.reported && <Resolve report={r} />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}

function Resolve({ report }: { report: Report }) {
  return (
    <ActForm intent="report" fields={{ report: report.id, user: report.reported?.id }} className="space-y-2">
      {({ pending }) => (
        <>
          <textarea name="resolution" required rows={2} maxLength={1000} placeholder="What you found and did" className={inputClass} />
          <select name="hold" defaultValue="" className={inputClass} aria-label="Hold on the reported account">
            <option value="">No hold</option>
            <option value="review">Hold for review</option>
            <option value="selfie">Ask for a selfie</option>
            <option value="banned">Ban</option>
          </select>
          <Button tone="primary" pending={pending}>
            Close the report
          </Button>
        </>
      )}
    </ActForm>
  );
}

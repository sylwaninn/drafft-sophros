import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
import type { Overview } from "~/lib/types";
import { Card, Page, Stat } from "~/components/ui";
import type { Route } from "./+types/overview";

export async function loader({ context }: Route.LoaderArgs) {
  return query<Overview>(context.get(staffContext), "admin_overview");
}

const number = new Intl.NumberFormat("en-GB");

export default function OverviewPage({ loaderData: o }: Route.ComponentProps) {
  const max = Math.max(1, ...o.signupsByDay.map((d) => d.count));
  const queue = [
    { label: "Selfies to compare", value: o.selfiesToCheck, to: "/verifications" },
    { label: "Accounts in review", value: (o.holds.review ?? 0) - o.selfiesToCheck, to: "/verifications#reviews" },
    { label: "Open reports", value: o.openReports, to: "/reports" },
    { label: "Open support requests", value: o.openSupport, to: "/support" },
    { label: "Data exports to send", value: o.openDataRequests, to: "/support#exports" },
    { label: "Photos to review", value: o.mediaToReview, to: "/photos" },
    { label: "Flagged media to look at", value: o.openFlags, to: "/flags" },
  ];
  return (
    <Page title="Overview" subtitle="What's waiting for the team, and how drafft is doing.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {queue.map((q) => (
          <Stat key={q.label} label={q.label} value={number.format(q.value)} to={q.to} tone={q.value > 0 ? "alert" : undefined} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Accounts" value={number.format(o.accounts)} to="/accounts" />
        <Stat label="Onboarded" value={number.format(o.onboarded)} />
        <Stat label="Sign-ups, 7 days" value={number.format(o.signups7d)} />
        <Stat label="drafft tempo" value={number.format(o.premium)} to="/accounts?filter=premium" />
        <Stat label="Active today" value={number.format(o.active1d)} to="/accounts?filter=active" />
        <Stat label="Active, 7 days" value={number.format(o.active7d)} />
        <Stat label="Opened the app today" value={number.format(o.opened1d)} />
        <Stat label="Matches, 7 days" value={number.format(o.matches7d)} />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[2fr_1fr]">
        <Card title="Sign-ups, last 14 days">
          <div className="flex h-36 items-end gap-1.5">
            {o.signupsByDay.map((d) => (
              <div key={d.day} className="group flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.count}`}>
                <span className="text-[10px] text-mute opacity-0 group-hover:opacity-100">{d.count}</span>
                <div className="w-full rounded-t bg-lime" style={{ height: `${Math.max(2, (d.count / max) * 112)}px` }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-mute">
            <span>{o.signupsByDay[0]?.day}</span>
            <span>{o.signupsByDay.at(-1)?.day}</span>
          </div>
        </Card>
        <Card title="Holds">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Review" value={o.holds.review ?? 0} to="/accounts?filter=review" />
            <Stat label="Selfie" value={o.holds.selfie ?? 0} to="/accounts?filter=selfie" />
            <Stat label="Banned" value={o.holds.banned ?? 0} to="/accounts?filter=banned" />
          </div>
        </Card>
      </div>
    </Page>
  );
}

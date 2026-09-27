import { Form, useSearchParams } from "react-router";
import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
import type { DataRequest, SupportRequest } from "~/lib/types";
import { ActForm, Button, inputClass } from "~/components/actions";
import { Badge, Card, Empty, Mono, Page, PersonLink, Tabs, Time } from "~/components/ui";
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
  const all = params.get("status") === "all";
  const q = params.get("q") ?? "";
  return (
    <Page title="Support" subtitle="Messages from the app's help forms. Reply by email with the reference in the subject.">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          items={[
            { label: "Open", to: q ? `?q=${encodeURIComponent(q)}` : "?", active: !all },
            { label: "All", to: `?status=all${q ? `&q=${encodeURIComponent(q)}` : ""}`, active: all },
          ]}
        />
        <Form method="get" className="mb-4 flex-1">
          {all && <input type="hidden" name="status" value="all" />}
          <input name="q" type="search" defaultValue={q} placeholder="Reference, email or words" className={`${inputClass} max-w-sm`} />
        </Form>
      </div>

      {requests.length === 0 ? (
        <Card>
          <Empty>No {all ? "" : "open "}request.</Empty>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Mono>{s.reference}</Mono>
                    <span className="font-semibold">{s.topic}</span>
                    <Badge>{s.language}</Badge>
                    <Time value={s.created_at} />
                    {s.handled_at && (
                      <Badge tone="lime" title={`by ${s.handled_by}`}>
                        handled
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-body">
                    {s.person ? <PersonLink person={s.person} size={22} /> : <span className="text-mute">signed out</span>}
                    <a className="underline" href={`mailto:${s.email}?subject=${encodeURIComponent(`[${s.reference}] ${s.topic}`)}`}>
                      {s.email}
                    </a>
                  </div>
                  <p className="rounded-lg bg-soft p-3 whitespace-pre-wrap">{s.message}</p>
                  {Object.keys(s.context ?? {}).length > 0 && (
                    <p className="text-xs text-mute">
                      {Object.entries(s.context).map(([k, v]) => (
                        <span key={k} className="mr-3">
                          {k}: <span className="text-body">{typeof v === "string" ? v : JSON.stringify(v)}</span>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                <ActForm intent="support" fields={{ id: s.id, handled: s.handled_at ? "false" : "true" }}>
                  {({ pending }) => (
                    <Button tone={s.handled_at ? "quiet" : "primary"} pending={pending}>
                      {s.handled_at ? "Reopen" : "Mark handled"}
                    </Button>
                  )}
                </ActForm>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card id="exports" title="Data exports asked for" aside="send the export by email, then mark it sent" className="mt-6">
        {exports.length === 0 ? (
          <Empty>No export to send.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {exports.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <PersonLink person={d.person} size={22} />
                  <span className="text-body">{d.email}</span>
                  <span className="text-mute">
                    asked <Time value={d.created_at} />
                  </span>
                </span>
                {d.fulfilled_at ? (
                  <Badge title={`by ${d.fulfilled_by}`}>sent</Badge>
                ) : (
                  <ActForm intent="data-request" fields={{ id: d.id }}>
                    {({ pending }) => (
                      <Button pending={pending} tone="primary">
                        Mark sent
                      </Button>
                    )}
                  </ActForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}

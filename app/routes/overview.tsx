import { Link } from "react-router";
import { ChevronRightIcon, DownloadIcon, ScanFaceIcon, ShieldBanIcon, ShieldQuestionIcon, UserRoundSearchIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "~/components/ui/item";
import { Page, PageHeader, Panel } from "~/components/app/bits";
import { ago } from "~/components/app/format";
import { nav } from "~/components/app/nav";
import { useRoot, type QueueCount } from "~/components/app/root-data";
import { can } from "~/lib/roles";

const queues: { key: keyof ReturnType<typeof useRoot>["queues"]; to: string; title: string; what: string }[] = [
  { key: "selfies", to: "/verifications", title: "Selfies to compare", what: "Same person as the photos?" },
  { key: "reports", to: "/reports", title: "Reports", what: "Read, decide, close with a resolution." },
  { key: "reviews", to: "/verifications?tab=reviews", title: "Accounts in review", what: "Held automatically or by the team." },
  { key: "flags", to: "/shared-media", title: "Shared media", what: "Photos sent in chats that the silent check flagged." },
  { key: "photos", to: "/profile-photos", title: "Profile photos", what: "Borderline, second looks, and ones refused on their own." },
  { key: "support", to: "/support", title: "Support requests", what: "Messages from the app's help forms." },
  { key: "exports", to: "/support?tab=exports", title: "Data exports", what: "Send each person their data, then mark it sent." },
  { key: "selfieOwed", to: "/verifications?tab=owed", title: "Selfies owed", what: "Asked, not sent yet. Nothing to do." },
];

function QueueRow({ q, count }: { q: (typeof queues)[number]; count: QueueCount }) {
  const icon = nav.find((n) => q.to.startsWith(n.to) && n.to !== "/")?.icon ?? DownloadIcon;
  const Icon = q.key === "exports" ? DownloadIcon : q.key === "reviews" ? UserRoundSearchIcon : icon;
  const waiting = count.count > 0;
  return (
    <Item asChild variant="outline" className={waiting ? undefined : "opacity-60"}>
      <Link to={q.to} viewTransition prefetch="intent">
        <ItemMedia variant="icon">
          <Icon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{q.title}</ItemTitle>
          <ItemDescription>
            {waiting && count.oldest ? (
              <>
                Oldest waiting since {ago(count.oldest).replace(" ago", "")}. {q.what}
              </>
            ) : (
              q.what
            )}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Badge variant={waiting ? "default" : "secondary"} className="min-w-8">
            {count.count}
          </Badge>
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </ItemActions>
      </Link>
    </Item>
  );
}

export default function Overview() {
  const { queues: counts, holds, staff } = useRoot();
  const visible = queues.filter((q) => q.key !== "flags" || can(staff, "moderator"));
  const open = visible.filter((q) => counts[q.key].count > 0 && q.key !== "selfieOwed");
  const oldestFirst = [...visible].sort((a, b) => {
    const [ca, cb] = [counts[a.key], counts[b.key]];
    if (!ca.count !== !cb.count) return ca.count ? -1 : 1;
    return (ca.oldest ?? "").localeCompare(cb.oldest ?? "");
  });
  return (
    <Page>
      <PageHeader
        title={open.length ? "What's waiting" : "All clear"}
        description={
          open.length
            ? "Every queue, the one waiting longest first. Each case needs a person; each decision takes a reason."
            : "Nothing waits for a person right now."
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ItemGroup className="gap-3">
          {oldestFirst.map((q) => (
            <QueueRow key={q.key} q={q} count={counts[q.key]} />
          ))}
        </ItemGroup>
        <Panel title="Accounts on hold" description="Frozen: hidden from everyone, chats read-only." className="self-start">
          <ItemGroup className="gap-2">
            {(
              [
                ["review", "In review", ShieldQuestionIcon],
                ["selfie", "Selfie asked", ScanFaceIcon],
                ["banned", "Banned", ShieldBanIcon],
              ] as const
            ).map(([filter, label, Icon]) => (
              <Item key={filter} asChild size="sm" variant="muted">
                <Link to={`/accounts?filter=${filter}`} viewTransition>
                  <ItemMedia variant="icon">
                    <Icon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{label}</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <span className="text-sm font-medium tabular-nums">{holds[filter]}</span>
                  </ItemActions>
                </Link>
              </Item>
            ))}
          </ItemGroup>
        </Panel>
      </div>
    </Page>
  );
}

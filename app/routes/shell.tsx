import { Form, NavLink, Outlet, useNavigation } from "react-router";
import { can, type Role } from "~/lib/roles";
import { cx, useRoot } from "~/components/ui";

const nav: { to: string; label: string; count?: string; role: Role }[][] = [
  [
    { to: "/", label: "Overview", role: "support" },
    { to: "/accounts", label: "Accounts", role: "support" },
  ],
  [
    { to: "/verifications", label: "Verifications", count: "verifications", role: "support" },
    { to: "/reports", label: "Reports", count: "reports", role: "support" },
    { to: "/support", label: "Support", count: "support", role: "support" },
    { to: "/photos", label: "Photo reviews", count: "photos", role: "support" },
    { to: "/flags", label: "Flagged media", count: "flags", role: "moderator" },
    { to: "/conversations", label: "Conversations", role: "moderator" },
  ],
  [
    { to: "/audit", label: "Audit log", role: "admin" },
    { to: "/staff", label: "Staff", role: "admin" },
  ],
];

const envStyle = {
  local: "bg-soft-2 text-body",
  staging: "bg-warning text-ink",
  production: "bg-negative text-canvas",
};

export default function Shell() {
  const { staff, env, counts } = useRoot();
  const navigation = useNavigation();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-line bg-canvas">
        <div className="px-4 pt-4 pb-3">
          <div className="text-lg font-semibold tracking-tight">sophros</div>
          <div className={cx("mt-1.5 inline-block rounded-md px-2 py-0.5 text-xs font-semibold", envStyle[env])}>{env}</div>
        </div>
        <Form method="get" action="/accounts" className="px-3 pb-3">
          <input
            name="q"
            type="search"
            placeholder="Find an account"
            aria-label="Find an account by name, email, phone or id"
            className="w-full rounded-lg bg-soft px-3 py-1.5 text-sm placeholder:text-mute focus:bg-canvas focus:outline-1 focus:outline-line"
          />
        </Form>
        <nav className="flex-1 space-y-3 overflow-y-auto px-2 text-sm">
          {nav.map((group, i) => (
            <ul key={i} className="space-y-0.5">
              {group
                .filter((item) => can(staff, item.role))
                .map((item) => {
                  const count = item.count ? counts[item.count] : 0;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === "/"}
                        className={({ isActive }) =>
                          cx("flex items-center justify-between rounded-lg px-3 py-1.5", isActive ? "bg-ink text-canvas" : "text-body hover:bg-soft")
                        }
                      >
                        {item.label}
                        {count > 0 && <span className="rounded-full bg-lime px-1.5 text-xs font-semibold text-ink">{count}</span>}
                      </NavLink>
                    </li>
                  );
                })}
            </ul>
          ))}
        </nav>
        <div className="border-t border-line px-4 py-3 text-xs">
          <div className="truncate font-medium" title={staff.email}>
            {staff.email}
          </div>
          <div className="text-mute">{staff.role}</div>
        </div>
      </aside>
      <main className={cx("min-w-0 flex-1 transition-opacity", navigation.state === "loading" && "opacity-60")}>
        <Outlet />
      </main>
    </div>
  );
}

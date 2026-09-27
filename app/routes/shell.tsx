import { Fragment } from "react";
import { Link, Outlet, useLocation, useMatches, useNavigation } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { Spinner } from "~/components/ui/spinner";
import { AppSidebar } from "~/components/app/app-sidebar";
import { nav } from "~/components/app/nav";
import { useRoot } from "~/components/app/root-data";
import { SearchCommand } from "~/components/app/search-command";

/** Pages can name themselves in the breadcrumb: `export const handle = { crumb: (data) => "…" }`. */
export interface Crumb {
  crumb?: (data: unknown) => string;
}

function Crumbs() {
  const { pathname } = useLocation();
  const matches = useMatches();
  const section = nav.find((n) => (n.to === "/" ? pathname === "/" : pathname.startsWith(n.to)));
  const leaf = [...matches].reverse().find((m) => (m.handle as Crumb | undefined)?.crumb);
  const leafLabel = leaf ? (leaf.handle as Crumb).crumb!(leaf.loaderData) : null;
  const trail = [section && { label: section.label, to: section.to }, leafLabel && { label: leafLabel, to: pathname }].filter(Boolean) as {
    label: string;
    to: string;
  }[];
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {trail.map((c, i) => (
          <Fragment key={c.to}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {i === trail.length - 1 ? (
                <BreadcrumbPage className="max-w-48 truncate">{c.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={c.to} viewTransition>
                    {c.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default function Shell() {
  const { sidebarOpen } = useRoot();
  const navigation = useNavigation();
  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/80 px-4 backdrop-blur supports-backdrop-filter:bg-background/70">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Crumbs />
          <div className="ml-auto flex items-center gap-3">
            {navigation.state !== "idle" && <Spinner className="text-muted-foreground" />}
            <SearchCommand />
          </div>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}

import { NavLink, useFetcher, useLocation } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronsUpDownIcon, MoonIcon, ShieldIcon, SunIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "~/components/ui/sidebar";
import { isActive, navGroups, useVisibleNav, type NavItem } from "./nav";
import { useRoot } from "./root-data";

const envBadge = {
  local: "secondary",
  staging: "outline",
  production: "destructive",
} as const;

/** A queue count that rolls to its new value when an item is resolved. */
function Count({ value }: { value: number }) {
  const reduce = useReducedMotion();
  return (
    <SidebarMenuBadge className="overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={reduce ? false : { y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? undefined : { y: -10, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </SidebarMenuBadge>
  );
}

function NavEntry({ item, active, count }: { item: NavItem; active: boolean; count: number }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
        <NavLink to={item.to} viewTransition prefetch="intent">
          <item.icon />
          <span>{item.label}</span>
        </NavLink>
      </SidebarMenuButton>
      {count > 0 && <Count value={count} />}
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { staff, env, queues, theme } = useRoot();
  const nav = useVisibleNav();
  const { pathname, search } = useLocation();
  const themeFetcher = useFetcher();
  const shownTheme = (themeFetcher.formData?.get("theme") as string | undefined) ?? theme;

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/" viewTransition>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ShieldIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">sophros</span>
                  <span className="truncate text-xs text-muted-foreground">drafft moderation</span>
                </div>
                <Badge variant={envBadge[env]} className="capitalize">
                  {env}
                </Badge>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {[null, ...navGroups].map((group) => {
          const items = nav.filter((n) => n.group === group);
          if (!items.length) return null;
          return (
            <SidebarGroup key={group ?? "top"}>
              {group && <SidebarGroupLabel>{group}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <NavEntry key={item.to} item={item} active={isActive(item, pathname, search)} count={item.count?.(queues) ?? 0} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">{staff.email.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{staff.email}</span>
                    <span className="truncate text-xs text-muted-foreground capitalize">{staff.role}</span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{staff.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {staff.role} on {env}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() =>
                    themeFetcher.submit({ theme: shownTheme === "dark" ? "light" : "dark" }, { method: "post", action: "/theme" })
                  }
                >
                  {shownTheme === "dark" ? <SunIcon /> : <MoonIcon />}
                  {shownTheme === "dark" ? "Light theme" : "Dark theme"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

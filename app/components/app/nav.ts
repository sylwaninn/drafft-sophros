import {
  DownloadIcon,
  FileClockIcon,
  ImageIcon,
  InboxIcon,
  LifeBuoyIcon,
  MessagesSquareIcon,
  ScanFaceIcon,
  ServerCrashIcon,
  ShieldAlertIcon,
  SquareUserRoundIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react";
import { can, type Role } from "~/lib/roles";
import { useRoot, type RootData } from "./root-data";

// What to decide on first, then who to look into, then people waiting for an answer, then the team.
export const navGroups = ["Moderation", "Investigate", "Support", "Admin"] as const;

export interface NavItem {
  to: string;
  label: string;
  icon: typeof InboxIcon;
  group: (typeof navGroups)[number] | null;
  role: Role;
  count?: (q: RootData["queues"]) => number;
}

export const nav: NavItem[] = [
  { to: "/", label: "What's waiting", icon: InboxIcon, group: null, role: "support" },
  {
    to: "/verifications",
    label: "Verifications",
    icon: ScanFaceIcon,
    group: "Moderation",
    role: "support",
    count: (q) => q.selfies.count + q.reviews.count,
  },
  {
    to: "/profile-photos",
    label: "Profile photos",
    icon: SquareUserRoundIcon,
    group: "Moderation",
    role: "support",
    count: (q) => q.photos.count,
  },
  { to: "/shared-media", label: "Shared media", icon: ImageIcon, group: "Moderation", role: "moderator", count: (q) => q.flags.count },
  { to: "/reports", label: "Reports", icon: ShieldAlertIcon, group: "Moderation", role: "support", count: (q) => q.reports.count },
  { to: "/accounts", label: "Accounts", icon: UsersIcon, group: "Investigate", role: "support" },
  { to: "/conversations", label: "Conversations", icon: MessagesSquareIcon, group: "Investigate", role: "moderator" },
  { to: "/support", label: "Requests", icon: LifeBuoyIcon, group: "Support", role: "support", count: (q) => q.support.count },
  {
    to: "/support?tab=exports",
    label: "Data exports",
    icon: DownloadIcon,
    group: "Support",
    role: "support",
    count: (q) => q.exports.count,
  },
  { to: "/audit", label: "Audit log", icon: FileClockIcon, group: "Admin", role: "admin" },
  { to: "/failed-events", label: "Failed events", icon: ServerCrashIcon, group: "Admin", role: "admin" },
  { to: "/staff", label: "Staff", icon: UserCogIcon, group: "Admin", role: "admin" },
];

/** Whether a nav item is the page on screen (a `?tab=` item matches that tab only). */
export function isActive(item: NavItem, pathname: string, search: string) {
  const [path, query] = item.to.split("?");
  if (path === "/") return pathname === "/";
  if (!pathname.startsWith(path)) return false;
  const tab = new URLSearchParams(search).get("tab");
  const itemTab = query ? new URLSearchParams(query).get("tab") : null;
  return itemTab
    ? tab === itemTab
    : !nav.some((n) => n !== item && n.to.startsWith(`${path}?`) && tab === new URLSearchParams(n.to.split("?")[1]).get("tab"));
}

export function useVisibleNav() {
  const { staff } = useRoot();
  return nav.filter((item) => can(staff, item.role));
}

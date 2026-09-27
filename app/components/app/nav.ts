import {
  FileClockIcon,
  FlagIcon,
  ImageIcon,
  InboxIcon,
  LayoutListIcon,
  LifeBuoyIcon,
  MessagesSquareIcon,
  ScanFaceIcon,
  ShieldAlertIcon,
  UsersIcon,
  UserCogIcon,
} from "lucide-react";
import { can, type Role } from "~/lib/roles";
import { useRoot, type RootData } from "./root-data";

export const navGroups = ["Queues", "Investigate", "Admin"] as const;

export interface NavItem {
  to: string;
  label: string;
  icon: typeof InboxIcon;
  group: (typeof navGroups)[number];
  role: Role;
  count?: (q: RootData["queues"]) => number;
}

export const nav: NavItem[] = [
  { to: "/", label: "Queues", icon: LayoutListIcon, group: "Queues", role: "support" },
  {
    to: "/verifications",
    label: "Verifications",
    icon: ScanFaceIcon,
    group: "Queues",
    role: "support",
    count: (q) => q.selfies.count + q.reviews.count,
  },
  { to: "/reports", label: "Reports", icon: ShieldAlertIcon, group: "Queues", role: "support", count: (q) => q.reports.count },
  { to: "/support", label: "Support", icon: LifeBuoyIcon, group: "Queues", role: "support", count: (q) => q.support.count + q.exports.count },
  { to: "/profile-photos", label: "Profile photos", icon: ImageIcon, group: "Queues", role: "support", count: (q) => q.photos.count },
  { to: "/shared-media", label: "Shared media", icon: FlagIcon, group: "Queues", role: "moderator", count: (q) => q.flags.count },
  { to: "/accounts", label: "Accounts", icon: UsersIcon, group: "Investigate", role: "support" },
  { to: "/conversations", label: "Conversations", icon: MessagesSquareIcon, group: "Investigate", role: "moderator" },
  { to: "/audit", label: "Audit log", icon: FileClockIcon, group: "Admin", role: "admin" },
  { to: "/staff", label: "Staff", icon: UserCogIcon, group: "Admin", role: "admin" },
];

export function useVisibleNav() {
  const { staff } = useRoot();
  return nav.filter((item) => can(staff, item.role));
}

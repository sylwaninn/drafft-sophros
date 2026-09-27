import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("act", "routes/act.ts"),
  route("search", "routes/search.ts"),
  route("theme", "routes/theme.ts"),
  route("conversation-data/:id", "routes/conversation-data.ts"),
  layout("routes/shell.tsx", [
    layout("routes/pane.tsx", [
    index("routes/overview.tsx"),
    route("accounts", "routes/accounts.tsx"),
    route("accounts/:id", "routes/account.tsx"),
    route("verifications", "routes/verifications.tsx"),
    route("profile-photos", "routes/profile-photos.tsx"),
    route("shared-media", "routes/shared-media.tsx"),
    route("reports", "routes/reports.tsx"),
    route("support", "routes/support.tsx"),
    route("conversations", "routes/conversations.tsx"),
    route("audit", "routes/audit.tsx"),
    route("staff", "routes/staff.tsx"),
    ]),
  ]),
] satisfies RouteConfig;

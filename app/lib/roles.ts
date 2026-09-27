// Staff roles, each with the rights of the one before. The database checks them again on every call
// (private.require_staff in drafft-backend): hiding a button here is comfort, not security.
export type Role = "support" | "moderator" | "admin";

export interface Staff {
  email: string;
  role: Role;
}

const rank: Record<Role, number> = { support: 1, moderator: 2, admin: 3 };

export function can(staff: Staff, role: Role): boolean {
  return rank[staff.role] >= rank[role];
}

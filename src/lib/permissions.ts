import { Role, PeriodStatus } from "@/types";

export type Permission =
  | "users:manage"
  | "periods:read"
  | "periods:write"
  | "periods:delete"
  | "periods:submit"
  | "periods:approve"
  | "periods:close"
  | "periods:reopen"
  | "employees:read"
  | "employees:write"
  | "positions:read"
  | "positions:write"
  | "seasons:read"
  | "seasons:write"
  | "rules:read"
  | "rules:write"
  | "reports:read"
  | "audit:read"
  | "export:payroll"
  | "import:data"
  | "simulation:run"
  | "settings:write";

const rolePermissions: Record<Role, Permission[]> = {
  ADMIN: [
    "users:manage",
    "periods:read",
    "periods:write",
    "periods:delete",
    "periods:submit",
    "periods:approve",
    "periods:close",
    "periods:reopen",
    "employees:read",
    "employees:write",
    "positions:read",
    "positions:write",
    "seasons:read",
    "seasons:write",
    "rules:read",
    "rules:write",
    "reports:read",
    "audit:read",
    "export:payroll",
    "import:data",
    "simulation:run",
    "settings:write",
  ],
  BUSINESS_UNIT_LEAD: [
    "periods:read",
    "periods:write",
    "periods:delete",
    "periods:submit",
    "periods:approve",
    "periods:close",
    "periods:reopen",
    "employees:read",
    "employees:write",
    "positions:read",
    "positions:write",
    "seasons:read",
    "seasons:write",
    "rules:read",
    "rules:write",
    "reports:read",
    "audit:read",
    "export:payroll",
    "import:data",
    "simulation:run",
    "settings:write",
  ],
  STORE_MANAGER: [
    "periods:read",
    "periods:write",
    "periods:submit",
    "employees:read",
    "employees:write",
    "positions:read",
    "seasons:read",
    "rules:read",
    "reports:read",
    "import:data",
    "simulation:run",
  ],
  FINANCE_VIEWER: [
    "periods:read",
    "employees:read",
    "positions:read",
    "seasons:read",
    "rules:read",
    "reports:read",
    "audit:read",
  ],
  PAYROLL_EXPORT_USER: [
    "periods:read",
    "employees:read",
    "reports:read",
    "export:payroll",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function canTransitionStatus(
  role: Role,
  fromStatus: PeriodStatus,
  toStatus: PeriodStatus
): boolean {
  const transitions: Record<
    PeriodStatus,
    { to: PeriodStatus; roles: Role[] }[]
  > = {
    DRAFT: [
      {
        to: "PENDING_APPROVAL",
        roles: ["ADMIN", "BUSINESS_UNIT_LEAD", "STORE_MANAGER"],
      },
    ],
    PENDING_APPROVAL: [
      { to: "APPROVED", roles: ["ADMIN", "BUSINESS_UNIT_LEAD"] },
      { to: "DRAFT", roles: ["ADMIN", "BUSINESS_UNIT_LEAD"] },
    ],
    APPROVED: [
      { to: "CLOSED", roles: ["ADMIN", "BUSINESS_UNIT_LEAD"] },
    ],
    CLOSED: [],
  };

  const allowed = transitions[fromStatus] ?? [];
  const match = allowed.find((t) => t.to === toStatus);
  return match ? match.roles.includes(role) : false;
}

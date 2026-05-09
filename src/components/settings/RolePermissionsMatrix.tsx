"use client";

import { Role } from "@/types";
import { Permission } from "@/lib/permissions";

const PERMISSIONS: { key: Permission; label: string; group: string }[] = [
  { key: "users:manage", label: "Felhasználók kezelése", group: "Rendszer" },
  { key: "settings:write", label: "Beállítások módosítása", group: "Rendszer" },
  { key: "audit:read", label: "Audit napló olvasása", group: "Rendszer" },
  { key: "periods:read", label: "Periódusok megtekintése", group: "Periódusok" },
  { key: "periods:write", label: "Periódusok szerkesztése", group: "Periódusok" },
  { key: "periods:delete", label: "Periódusok törlése", group: "Periódusok" },
  { key: "periods:submit", label: "Jóváhagyásra küldés", group: "Periódusok" },
  { key: "periods:approve", label: "Periódus jóváhagyása", group: "Periódusok" },
  { key: "periods:close", label: "Periódus lezárása", group: "Periódusok" },
  { key: "periods:reopen", label: "Periódus újranyitása", group: "Periódusok" },
  { key: "employees:read", label: "Dolgozók megtekintése", group: "Dolgozók" },
  { key: "employees:write", label: "Dolgozók szerkesztése", group: "Dolgozók" },
  { key: "positions:read", label: "Pozíciók megtekintése", group: "Pozíciók / Szezonok" },
  { key: "positions:write", label: "Pozíciók szerkesztése", group: "Pozíciók / Szezonok" },
  { key: "seasons:read", label: "Szezonok megtekintése", group: "Pozíciók / Szezonok" },
  { key: "seasons:write", label: "Szezonok szerkesztése", group: "Pozíciók / Szezonok" },
  { key: "rules:read", label: "Üzleti szabályok megtekintése", group: "Szabályok" },
  { key: "rules:write", label: "Üzleti szabályok szerkesztése", group: "Szabályok" },
  { key: "reports:read", label: "Riportok megtekintése", group: "Riportok / Export" },
  { key: "export:payroll", label: "Bérszámfejtés exportálása", group: "Riportok / Export" },
  { key: "import:data", label: "Adatok importálása", group: "Riportok / Export" },
  { key: "simulation:run", label: "Szimuláció futtatása", group: "Riportok / Export" },
];

const ROLES: { key: Role; label: string; color: string }[] = [
  { key: "ADMIN", label: "Admin", color: "bg-purple-100 text-purple-800" },
  { key: "BUSINESS_UNIT_LEAD", label: "BU Lead", color: "bg-blue-100 text-blue-800" },
  { key: "STORE_MANAGER", label: "Store Mgr", color: "bg-green-100 text-green-800" },
  { key: "FINANCE_VIEWER", label: "Finance", color: "bg-yellow-100 text-yellow-800" },
  { key: "PAYROLL_EXPORT_USER", label: "Payroll", color: "bg-orange-100 text-orange-800" },
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "users:manage", "periods:read", "periods:write", "periods:delete", "periods:submit",
    "periods:approve", "periods:close", "periods:reopen", "employees:read", "employees:write",
    "positions:read", "positions:write", "seasons:read", "seasons:write", "rules:read",
    "rules:write", "reports:read", "audit:read", "export:payroll", "import:data",
    "simulation:run", "settings:write",
  ],
  BUSINESS_UNIT_LEAD: [
    "periods:read", "periods:write", "periods:delete", "periods:submit", "periods:approve",
    "periods:close", "periods:reopen", "employees:read", "employees:write", "positions:read",
    "positions:write", "seasons:read", "seasons:write", "rules:read", "rules:write",
    "reports:read", "audit:read", "export:payroll", "import:data", "simulation:run",
    "settings:write",
  ],
  STORE_MANAGER: [
    "periods:read", "periods:write", "periods:submit", "employees:read", "employees:write",
    "positions:read", "seasons:read", "rules:read", "reports:read", "import:data",
    "simulation:run",
  ],
  FINANCE_VIEWER: [
    "periods:read", "employees:read", "positions:read", "seasons:read", "rules:read",
    "reports:read", "audit:read",
  ],
  PAYROLL_EXPORT_USER: [
    "periods:read", "employees:read", "reports:read", "export:payroll",
  ],
};

export function RolePermissionsMatrix() {
  const groups = Array.from(new Set(PERMISSIONS.map((p) => p.group)));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left px-4 py-3 font-medium text-gray-500 border border-gray-200 min-w-[240px]">
              Jogosultság
            </th>
            {ROLES.map((role) => (
              <th key={role.key} className="px-3 py-3 text-center font-medium border border-gray-200 min-w-[90px]">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${role.color}`}>
                  {role.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const groupPerms = PERMISSIONS.filter((p) => p.group === group);
            return [
              <tr key={`group-${group}`}>
                <td
                  colSpan={ROLES.length + 1}
                  className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 border border-gray-200"
                >
                  {group}
                </td>
              </tr>,
              ...groupPerms.map((perm) => (
                <tr key={perm.key} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-700 border border-gray-100">
                    {perm.label}
                  </td>
                  {ROLES.map((role) => (
                    <td key={role.key} className="px-3 py-2.5 text-center border border-gray-100">
                      {ROLE_PERMISSIONS[role.key].includes(perm.key) ? (
                        <span className="text-emerald-600 font-bold text-base">✓</span>
                      ) : (
                        <span className="text-gray-200 text-base">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

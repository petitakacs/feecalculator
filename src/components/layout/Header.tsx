"use client";

import { signOut } from "next-auth/react";
import { Role } from "@/types";

interface HeaderProps {
  user: {
    name: string;
    email: string;
    role: Role;
  };
}

const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  BUSINESS_UNIT_LEAD: "Business Unit Lead",
  STORE_MANAGER: "Store Manager",
  FINANCE_VIEWER: "Finance Viewer",
  PAYROLL_EXPORT_USER: "Payroll Export",
};

export function Header({ user }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900">{user.name}</div>
          <div className="text-xs text-gray-500">{roleLabels[user.role] ?? user.role}</div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

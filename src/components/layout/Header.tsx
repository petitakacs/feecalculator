"use client";

import { signOut } from "next-auth/react";
import { MapPin } from "lucide-react";
import { Role, Location } from "@/types";
import { useLocationFilter } from "@/lib/location-context";

interface HeaderProps {
  user: {
    name: string;
    email: string;
    role: Role;
  };
  locations: Location[];
}

const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  BUSINESS_UNIT_LEAD: "Business Unit Lead",
  STORE_MANAGER: "Store Manager",
  FINANCE_VIEWER: "Finance Viewer",
  PAYROLL_EXPORT_USER: "Payroll Export",
};

export function Header({ user, locations }: HeaderProps) {
  const { selectedLocationId, setSelectedLocationId } = useLocationFilter();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      {/* Location selector */}
      <div className="flex items-center gap-2">
        <MapPin size={14} className="text-gray-400" />
        <select
          value={selectedLocationId ?? ""}
          onChange={(e) => setSelectedLocationId(e.target.value || null)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
        >
          <option value="">Összes lokáció</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {selectedLocationId && (
          <span className="text-xs text-gray-400">
            (szűrő aktív)
          </span>
        )}
      </div>

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

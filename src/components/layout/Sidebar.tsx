"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Briefcase,
  Layers,
  Settings,
  BarChart2,
  ClipboardList,
  Calculator,
  MapPin,
  ListChecks,
  UserCog,
  TrendingUp,
} from "lucide-react";
import { Role } from "@/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/periods", label: "Periods", icon: Calendar },
  { href: "/simulation", label: "Simulation", icon: Calculator },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/positions", label: "Positions", icon: Briefcase },
  { href: "/locations", label: "Locations", icon: MapPin },
  { href: "/seasons", label: "Seasons", icon: Layers },
  { href: "/extra-task-types", label: "Extra Tasks", icon: ListChecks },
  { href: "/analytics", label: "Analítika", icon: TrendingUp },
  { href: "/reports", label: "Reports", icon: BarChart2 },
  { href: "/audit", label: "Audit Log", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ userRole }: { userRole?: Role }) {
  const pathname = usePathname();
  const allItems =
    userRole === "ADMIN"
      ? [...navItems, { href: "/users", label: "Users", icon: UserCog }]
      : navItems;

  return (
    <div className="w-56 bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-sm font-bold text-gray-100">Café SC Manager</h1>
        <p className="text-xs text-gray-400 mt-0.5">Service Charge System</p>
      </div>

      <nav className="flex-1 py-4">
        {allItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

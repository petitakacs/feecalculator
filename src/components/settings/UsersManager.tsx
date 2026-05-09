"use client";

import { useState } from "react";
import { showToast } from "@/components/ui/toaster";
import { Role } from "@/types";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  BUSINESS_UNIT_LEAD: "BU vezető",
  STORE_MANAGER: "Üzletvezető",
  FINANCE_VIEWER: "Pénzügyes",
  PAYROLL_EXPORT_USER: "Bérszámfejtő",
};

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: "bg-red-100 text-red-800",
  BUSINESS_UNIT_LEAD: "bg-purple-100 text-purple-800",
  STORE_MANAGER: "bg-blue-100 text-blue-800",
  FINANCE_VIEWER: "bg-yellow-100 text-yellow-800",
  PAYROLL_EXPORT_USER: "bg-gray-100 text-gray-700",
};

const ALL_ROLES: Role[] = [
  "ADMIN",
  "BUSINESS_UNIT_LEAD",
  "STORE_MANAGER",
  "FINANCE_VIEWER",
  "PAYROLL_EXPORT_USER",
];

const BLANK_FORM = { name: "", email: "", password: "", role: "STORE_MANAGER" as Role };

export function UsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [toggling, setToggling] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [creating, setCreating] = useState(false);

  const patchUser = async (id: string, data: Partial<UserRow>) => {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Hiba");
    }
    return res.json() as Promise<UserRow>;
  };

  const handleToggleActive = async (user: UserRow) => {
    if (user.id === currentUserId && user.active) {
      showToast("Saját magadat nem lehet inaktiválni", "error");
      return;
    }
    setToggling(user.id);
    try {
      const updated = await patchUser(user.id, { active: !user.active });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      showToast(updated.active ? `${updated.name} aktiválva` : `${updated.name} inaktiválva`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Hiba", "error");
    } finally {
      setToggling(null);
    }
  };

  const handleRoleChange = async (user: UserRow, role: Role) => {
    setEditingRole(user.id);
    try {
      const updated = await patchUser(user.id, { role });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      showToast(`${updated.name} szerepköre módosítva`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Hiba", "error");
    } finally {
      setEditingRole(null);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      showToast("Minden kötelező mezőt töltsd ki", "error");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? "Hiba", "error");
        return;
      }
      const created: UserRow = await res.json();
      setUsers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "hu")));
      showToast(`${created.name} felhasználó létrehozva`, "success");
      setCreateOpen(false);
      setForm(BLANK_FORM);
    } catch {
      showToast("Hálózati hiba", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Inaktív felhasználók nem tudnak bejelentkezni. A saját fiókod nem inaktiválható.
        </p>
        <button
          onClick={() => { setForm(BLANK_FORM); setCreateOpen(true); }}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 font-medium"
        >
          + Új felhasználó
        </button>
      </div>

      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Név</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">E-mail</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Szerepkör</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Állapot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className={user.active ? "bg-white" : "bg-gray-50"}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${user.active ? "text-gray-900" : "text-gray-400 line-through"}`}>
                      {user.name}
                    </span>
                    {user.id === currentUserId && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Te</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{user.email}</td>
                <td className="px-4 py-3">
                  {editingRole === user.id ? (
                    <span className="text-xs text-gray-400 italic">Mentés...</span>
                  ) : (
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user, e.target.value as Role)}
                      disabled={user.id === currentUserId}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white disabled:opacity-50"
                    >
                      {ALL_ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  )}
                  <span className={`ml-2 inline-flex px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[user.role]}`}>
                    {ROLE_LABELS[user.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggleActive(user)}
                    disabled={toggling === user.id}
                    title={user.active ? "Inaktiválás" : "Aktiválás"}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                      user.active ? "bg-emerald-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        user.active ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-base font-semibold mb-4">Új felhasználó létrehozása</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Név *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Teljes név"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="pelda@cafe.hu"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jelszó *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Legalább 6 karakter"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Szerepkör</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Mégsem
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 text-sm text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50"
              >
                {creating ? "Létrehozás..." : "Létrehozás"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, UserX, UserCheck, ShieldCheck } from "lucide-react";
import { Role } from "@/types";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  BUSINESS_UNIT_LEAD: "Business Unit Lead",
  STORE_MANAGER: "Store Manager",
  FINANCE_VIEWER: "Finance Viewer",
  PAYROLL_EXPORT_USER: "Payroll Export",
};

const userFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string()
    .min(12, "Minimum 12 karakter")
    .regex(/[A-Z]/, "Kell legalább egy nagybetű")
    .regex(/[0-9]/, "Kell legalább egy szám")
    .regex(/[^A-Za-z0-9]/, "Kell legalább egy speciális karakter")
    .optional()
    .or(z.literal("")),
  role: z.enum([
    "ADMIN",
    "BUSINESS_UNIT_LEAD",
    "STORE_MANAGER",
    "FINANCE_VIEWER",
    "PAYROLL_EXPORT_USER",
  ]),
});

type UserFormData = z.infer<typeof userFormSchema>;

async function fetchUsers(): Promise<UserRow[]> {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export function UserManagement({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setModalOpen(false);
      reset();
      setSuccessMsg("User created successfully");
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UserFormData }) => {
      const payload: Record<string, unknown> = {
        name: data.name,
        email: data.email,
        role: data.role,
      };
      if (data.password) payload.password = data.password;

      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setModalOpen(false);
      setEditingUser(null);
      reset();
      setSuccessMsg("User updated successfully");
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update user");
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (e: Error) => setError(e.message),
  });

  const openCreate = () => {
    setEditingUser(null);
    reset({ name: "", email: "", password: "", role: "STORE_MANAGER" });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (user: UserRow) => {
    setEditingUser(user);
    reset({ name: user.name, email: user.email, password: "", role: user.role });
    setError(null);
    setModalOpen(true);
  };

  const onSubmit = (data: UserFormData) => {
    setError(null);
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      if (!data.password) {
        setError("Password is required for new users");
        return;
      }
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-4">
      {successMsg && (
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded-md text-sm">
          {successMsg}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
        >
          <Plus size={16} />
          New User
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading users...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  2FA
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users?.map((user) => (
                <tr key={user.id} className={!user.active ? "opacity-50" : ""}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {user.name}
                    {user.id === currentUserId && (
                      <span className="ml-2 text-xs text-gray-400">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {user.email}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {user.twoFactorEnabled ? (
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <ShieldCheck size={14} />
                        <span className="text-xs">Enabled</span>
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Disabled</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        user.active
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {user.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(user)}
                        className="text-gray-500 hover:text-gray-700"
                        title="Edit user"
                      >
                        <Pencil size={15} />
                      </button>
                      {user.id !== currentUserId && (
                        <button
                          onClick={() =>
                            toggleActiveMutation.mutate({
                              id: user.id,
                              active: !user.active,
                            })
                          }
                          className={
                            user.active
                              ? "text-red-500 hover:text-red-700"
                              : "text-green-600 hover:text-green-800"
                          }
                          title={user.active ? "Deactivate" : "Activate"}
                        >
                          {user.active ? (
                            <UserX size={15} />
                          ) : (
                            <UserCheck size={15} />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingUser ? "Edit User" : "Create New User"}
            </h2>

            {error && (
              <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-md text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  type="text"
                  {...register("name")}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 text-sm"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  {...register("email")}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 text-sm"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {editingUser ? "New Password (leave blank to keep)" : "Password"}
                </label>
                <input
                  type="password"
                  {...register("password")}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 text-sm"
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Role
                </label>
                <select
                  {...register("role")}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 text-sm"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {errors.role && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.role.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 px-4 bg-gray-900 text-white rounded-md hover:bg-gray-700 text-sm font-medium disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingUser
                    ? "Save Changes"
                    : "Create User"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditingUser(null);
                    reset();
                    setError(null);
                  }}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

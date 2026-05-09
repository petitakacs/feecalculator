import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { UserManagement } from "@/components/users/UserManagement";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasPermission(session.user.role, "users:manage")) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create and manage system users and their access roles.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <UserManagement currentUserId={session.user.id} />
      </div>
    </div>
  );
}

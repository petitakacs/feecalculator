import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BusinessRulesManager } from "@/components/settings/BusinessRulesManager";
import { TwoFactorSettings } from "@/components/settings/TwoFactorSettings";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const [rules, currentUser] = await Promise.all([
    prisma.businessRule.findMany({
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorEnabled: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-1">Business Rules</h2>
        <p className="text-sm text-gray-500 mb-6">
          Configure the service charge percentage and employee contribution rate.
        </p>

        <BusinessRulesManager
          rules={rules.map((r) => ({
            id: r.id,
            effectiveFrom: r.effectiveFrom.toISOString().split("T")[0],
            effectiveTo: r.effectiveTo?.toISOString().split("T")[0] ?? undefined,
            serviceChargePercent: Number(r.serviceChargePercent),
            employeeContribution: Number(r.employeeContribution),
            notes: r.notes ?? undefined,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          }))}
          userRole={session.user.role}
        />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-1">Security</h2>
        <p className="text-sm text-gray-500 mb-6">
          Manage your account security settings.
        </p>

        <TwoFactorSettings
          twoFactorEnabled={currentUser?.twoFactorEnabled ?? false}
        />
      </div>
    </div>
  );
}

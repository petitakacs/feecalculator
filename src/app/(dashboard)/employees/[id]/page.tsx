import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EmployeeForm } from "@/components/employees/EmployeeForm";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const isNew = id === "new";

  const [employee, positions, locations] = await Promise.all([
    isNew
      ? Promise.resolve(null)
      : prisma.employee.findUnique({
          where: { id },
          include: { position: true, location: true },
        }),
    prisma.position.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  if (!isNew && !employee) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/employees" className="text-gray-500 hover:text-gray-700">
          ← Employees
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? "New Employee" : employee?.name}
        </h1>
      </div>

      <EmployeeForm
        employee={
          employee
            ? {
                id: employee.id,
                name: employee.name,
                active: employee.active,
                positionId: employee.positionId,
                baseSalaryType: employee.baseSalaryType,
                baseSalaryAmount: employee.baseSalaryAmount,
                eligibleForServiceCharge: employee.eligibleForServiceCharge,
                startDate: employee.startDate.toISOString().split("T")[0],
                endDate: employee.endDate?.toISOString().split("T")[0] ?? undefined,
                locationId: employee.locationId ?? undefined,
                notes: employee.notes ?? undefined,
                createdAt: employee.createdAt.toISOString(),
                updatedAt: employee.updatedAt.toISOString(),
              }
            : null
        }
        positions={positions.map((p) => ({
          id: p.id,
          name: p.name,
          multiplier: Number(p.multiplier),
          eligibleForServiceCharge: p.eligibleForServiceCharge,
          active: p.active,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }))}
        locations={locations.map((l) => ({
          id: l.id,
          name: l.name,
          address: l.address ?? undefined,
          active: l.active,
          createdAt: l.createdAt.toISOString(),
          updatedAt: l.updatedAt.toISOString(),
        }))}
        userRole={session.user.role}
      />
    </div>
  );
}

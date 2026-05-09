import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { EmployeesTable } from "@/components/employees/EmployeesTable";
import { Role } from "@/types";

export default async function EmployeesPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const employees = await prisma.employee.findMany({
    include: { position: true, variation: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dolgozók</h1>
        <Link
          href="/employees/new"
          className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
        >
          + Új dolgozó
        </Link>
      </div>

      <EmployeesTable
        initialEmployees={employees.map((emp) => ({
          id: emp.id,
          name: emp.name,
          positionName: emp.position.name,
          variationName: emp.variation?.name ?? undefined,
          locationId: emp.locationId ?? undefined,
          baseSalaryType: emp.baseSalaryType,
          baseSalaryAmount: Number(emp.baseSalaryAmount),
          startDate: emp.startDate.toISOString(),
          active: emp.active,
        }))}
        userRole={session.user.role as Role}
      />
    </div>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/format";

export default async function EmployeesPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const employees = await prisma.employee.findMany({
    include: { position: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        <Link
          href="/employees/new"
          className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
        >
          + Add Employee
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Position</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Salary Type</th>
              <th className="text-right px-6 py-3 font-medium text-gray-500">Base Salary</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Start Date</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{emp.name}</td>
                <td className="px-6 py-4 text-gray-500">{emp.position.name}</td>
                <td className="px-6 py-4 text-gray-500">{emp.baseSalaryType}</td>
                <td className="px-6 py-4 text-right">{formatCurrency(emp.baseSalaryAmount)}</td>
                <td className="px-6 py-4 text-gray-500">{formatDate(emp.startDate.toString())}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      emp.active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {emp.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/employees/${emp.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No employees yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SimulationForm } from "@/components/simulation/SimulationForm";

export default async function SimulationPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Simulation</h1>
        <p className="mt-1 text-sm text-gray-500">
          Simulate service charge distribution with different parameters
        </p>
      </div>
      <SimulationForm />
    </div>
  );
}

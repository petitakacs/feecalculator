"use client";

import { useState } from "react";
import { Role } from "@/types";
import { showToast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions";
import { formatPercent } from "@/lib/format";
import { Pencil, Trash2, MapPin } from "lucide-react";

interface LocationWithCount {
  id: string;
  name: string;
  address?: string;
  serviceChargePercent?: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { employees: number; periods: number };
}

interface LocationsManagerProps {
  initialLocations: LocationWithCount[];
  userRole: Role;
}

const emptyForm = { name: "", address: "", serviceChargePercent: "", active: true };

export function LocationsManager({ initialLocations, userRole }: LocationsManagerProps) {
  const canWrite = hasPermission(userRole, "settings:write");
  const [locations, setLocations] = useState(initialLocations);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    const res = await fetch("/api/locations");
    if (res.ok) setLocations(await res.json());
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const url = editId ? `/api/locations/${editId}` : "/api/locations";
      const method = editId ? "PATCH" : "POST";
      const scPct = form.serviceChargePercent !== ""
        ? parseFloat(form.serviceChargePercent) / 100
        : null;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          address: form.address || null,
          serviceChargePercent: scPct,
          active: form.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Mentés sikertelen", "error");
        return;
      }
      showToast(editId ? "Lokáció frissítve" : "Lokáció létrehozva", "success");
      setForm(emptyForm);
      setEditId(null);
      await refresh();
    } catch {
      showToast("Hálózati hiba", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Törlöd a(z) "${name}" lokációt?`)) return;
    const res = await fetch(`/api/locations/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Törlés sikertelen", "error");
      return;
    }
    showToast("Lokáció törölve", "success");
    await refresh();
  };

  const startEdit = (loc: LocationWithCount) => {
    setEditId(loc.id);
    setForm({
      name: loc.name,
      address: loc.address ?? "",
      serviceChargePercent: loc.serviceChargePercent != null
        ? String(loc.serviceChargePercent * 100)
        : "",
      active: loc.active,
    });
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-400";

  return (
    <div className="space-y-6">
      {canWrite && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold mb-4">
            {editId ? "Lokáció szerkesztése" : "Új lokáció"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Név *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
                placeholder="pl. Főétterem"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cím</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className={inputClass}
                placeholder="pl. Budapest, Fő u. 1."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SZD % (felülírja a globálist)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={form.serviceChargePercent}
                  onChange={(e) => setForm((f) => ({ ...f, serviceChargePercent: e.target.value }))}
                  className={inputClass}
                  placeholder="pl. 3.9"
                  min={0}
                  max={100}
                  step={0.1}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Üresen hagyva a globális szabályt használja</p>
            </div>
            <div className="flex items-end gap-3 pb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Aktív</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSave}
              disabled={loading || !form.name}
              className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? "Mentés..." : editId ? "Frissítés" : "Létrehozás"}
            </button>
            {editId && (
              <button
                onClick={() => { setEditId(null); setForm(emptyForm); }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md text-sm hover:bg-gray-200"
              >
                Mégsem
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Név</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Cím</th>
              <th className="text-center px-6 py-3 font-medium text-gray-500">SZD %</th>
              <th className="text-center px-6 py-3 font-medium text-gray-500">Dolgozók</th>
              <th className="text-center px-6 py-3 font-medium text-gray-500">Periódusok</th>
              <th className="text-center px-6 py-3 font-medium text-gray-500">Aktív</th>
              {canWrite && <th className="px-6 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {locations.map((loc) => (
              <tr key={loc.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium flex items-center gap-2">
                  <MapPin size={14} className="text-gray-400" />
                  {loc.name}
                </td>
                <td className="px-6 py-4 text-gray-500">{loc.address ?? "—"}</td>
                <td className="px-6 py-4 text-center">
                  {loc.serviceChargePercent != null ? (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {formatPercent(loc.serviceChargePercent)}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">globális</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center text-gray-600">{loc._count.employees}</td>
                <td className="px-6 py-4 text-center text-gray-600">{loc._count.periods}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${loc.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                    {loc.active ? "Igen" : "Nem"}
                  </span>
                </td>
                {canWrite && (
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(loc)} className="p-1.5 text-gray-500 hover:text-gray-700 rounded">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(loc.id, loc.name)} className="p-1.5 text-red-500 hover:text-red-700 rounded">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {locations.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                  Még nincs lokáció. Hozd létre az első lokációt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

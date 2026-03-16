"use client";

import { useEffect, useRef, useState } from "react";
import { pharmacy, pharmacyQueue, auth, API_BASE as BASE, type RxQueueItem } from "@/lib/api";

interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  manufacturer?: string;
  form?: string;
  strength?: string;
  unit?: string;
}

interface InventoryItem {
  id: string;
  stockQuantity: number;
  reorderLevel: number;
  batchNumber?: string;
  expiryDate?: string;
  sellingPrice?: number;
  costPrice?: number;
  medicine: Medicine;
}

export default function PharmacyPage() {
  const [tab, setTab] = useState<"medicines" | "inventory" | "low-stock" | "rx-queue">("rx-queue");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [rxQueue, setRxQueue] = useState<RxQueueItem[]>([]);
  const [clinicId, setClinicId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Add medicine form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", genericName: "", manufacturer: "", form: "", strength: "", unit: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // Fetch clinicId from doctor profile on mount
  useEffect(() => {
    auth.me().then((me) => {
      // clinicId is the doctor's associated clinic — use doctor id as fallback
      const docId = me.doctor?.id ?? "";
      setClinicId(docId);
    }).catch(() => null);
  }, []);

  useEffect(() => {
    setLoading(true);
    if (tab === "medicines") {
      pharmacy.listMedicines({ search: search || undefined }).then((r) => {
        setMedicines((r as { data: Medicine[] }).data);
      }).catch(() => null).finally(() => setLoading(false));
    } else if (tab === "inventory") {
      pharmacy.getInventory().then((r) => {
        setInventory(r as InventoryItem[]);
      }).catch(() => null).finally(() => setLoading(false));
    } else if (tab === "low-stock") {
      pharmacy.getLowStock().then((r) => {
        setLowStock(r as InventoryItem[]);
      }).catch(() => null).finally(() => setLoading(false));
    } else {
      pharmacyQueue.list().then((r) => {
        setRxQueue(r.data);
      }).catch(() => null).finally(() => setLoading(false));
    }
  }, [tab, search]);

  async function handleAddMedicine(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    setAddLoading(true);
    setAddError("");
    try {
      await pharmacy.createMedicine(addForm);
      setShowAdd(false);
      setAddForm({ name: "", genericName: "", manufacturer: "", form: "", strength: "", unit: "" });
      setTab("medicines");
      const r = await pharmacy.listMedicines({});
      setMedicines((r as { data: Medicine[] }).data);
    } catch (e: unknown) {
      setAddError((e as { data?: { error?: string } }).data?.error ?? "Failed to add medicine");
    } finally {
      setAddLoading(false);
    }
  }

  function refreshQueue() {
    pharmacyQueue.list().then((r) => setRxQueue(r.data)).catch(() => null);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pharmacy</h1>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Add Medicine
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAddMedicine} className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">New Medicine</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="e.g. Paracetamol"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Generic Name</label>
              <input
                type="text"
                value={addForm.genericName}
                onChange={(e) => setAddForm((f) => ({ ...f, genericName: e.target.value }))}
                placeholder="e.g. Acetaminophen"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Form</label>
              <input
                type="text"
                value={addForm.form}
                onChange={(e) => setAddForm((f) => ({ ...f, form: e.target.value }))}
                placeholder="e.g. Tablet, Syrup"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Strength</label>
              <input
                type="text"
                value={addForm.strength}
                onChange={(e) => setAddForm((f) => ({ ...f, strength: e.target.value }))}
                placeholder="e.g. 500mg"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Manufacturer</label>
              <input
                type="text"
                value={addForm.manufacturer}
                onChange={(e) => setAddForm((f) => ({ ...f, manufacturer: e.target.value }))}
                placeholder="e.g. Sun Pharma"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
              <input
                type="text"
                value={addForm.unit}
                onChange={(e) => setAddForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="e.g. strip, bottle"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          {addError && <p className="mt-3 text-sm text-red-600">{addError}</p>}
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={addLoading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {addLoading ? "Adding…" : "Add Medicine"}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {(["rx-queue", "inventory", "low-stock", "medicines"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setSearch(""); }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "low-stock" ? "Low Stock" : t === "rx-queue" ? "Rx Queue" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "medicines" && (
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search medicines…"
            className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Loading…</div>
      ) : tab === "medicines" ? (
        <MedicinesTable data={medicines} />
      ) : tab === "low-stock" ? (
        <InventoryTable data={lowStock} lowStock />
      ) : tab === "rx-queue" ? (
        <RxQueueTable data={rxQueue} clinicId={clinicId} onDispensed={refreshQueue} />
      ) : (
        <InventoryTable data={inventory} />
      )}
    </div>
  );
}

function MedicinesTable({ data }: { data: Medicine[] }) {
  if (!data.length) return <div className="py-16 text-center text-sm text-gray-400">No medicines found.</div>;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {["Name", "Generic", "Form", "Strength", "Manufacturer"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((m) => (
            <tr key={m.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{m.name}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{m.genericName ?? "—"}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{m.form ?? "—"}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{m.strength ?? "—"}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{m.manufacturer ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InventoryTable({ data, lowStock }: { data: InventoryItem[]; lowStock?: boolean }) {
  if (!data.length) return (
    <div className="py-16 text-center text-sm text-gray-400">
      {lowStock ? "No low-stock items." : "No inventory found. Add medicines and set inventory levels."}
    </div>
  );
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {["Medicine", "Stock", "Reorder Level", "Expiry", "Selling Price", "Batch"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((item) => (
            <tr key={item.id} className={`hover:bg-gray-50 ${item.stockQuantity <= item.reorderLevel ? "bg-red-50" : ""}`}>
              <td className="px-4 py-3">
                <p className="text-sm font-medium text-gray-900">{item.medicine.name}</p>
                {item.medicine.strength && <p className="text-xs text-gray-400">{item.medicine.strength} · {item.medicine.form}</p>}
              </td>
              <td className="px-4 py-3">
                <span className={`text-sm font-semibold ${item.stockQuantity <= item.reorderLevel ? "text-red-600" : "text-green-700"}`}>
                  {item.stockQuantity}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{item.reorderLevel}</td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString("en-IN") : "—"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {item.sellingPrice ? `₹${item.sellingPrice}` : "—"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{item.batchNumber ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RxQueueTable({ data, clinicId, onDispensed }: { data: RxQueueItem[]; clinicId: string; onDispensed: () => void }) {
  if (!data.length) return (
    <div className="py-16 text-center text-sm text-gray-400">No pending dispensing requests.</div>
  );
  return (
    <div className="space-y-4">
      {data.map((rx) => (
        <div key={rx.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">{rx.patient.phone}</p>
              {rx.consultation?.chiefComplaint && (
                <p className="text-xs text-gray-500 mt-0.5">{rx.consultation.chiefComplaint}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {rx.sentAt ? new Date(rx.sentAt).toLocaleDateString("en-IN") : "—"}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                rx.dispensing.length > 0 ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
              }`}>
                {rx.dispensing.length > 0 ? "Partial" : "Pending"}
              </span>
            </div>
          </div>
          {rx.dispensing.length > 0 && (
            <div className="mb-3 space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase">Dispensed:</p>
              {rx.dispensing.map((d) => (
                <p key={d.id} className="text-xs text-green-700">
                  ✓ {d.medicine.name} — qty {d.quantityDispensed}
                </p>
              ))}
            </div>
          )}
          <DispenseForm prescriptionId={rx.id} clinicId={clinicId} onSuccess={onDispensed} />
        </div>
      ))}
    </div>
  );
}

function DispenseForm({ prescriptionId, clinicId, onSuccess }: { prescriptionId: string; clinicId: string; onSuccess: () => void }) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medicineSearch, setMedicineSearch] = useState("");
  const [selectedMedicineId, setSelectedMedicineId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [dispensing, setDispensing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!medicineSearch.trim()) { setMedicines([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      pharmacy.listMedicines({ search: medicineSearch, limit: 5 }).then((r) => {
        setMedicines((r as { data: Medicine[] }).data);
      }).catch(() => null);
    }, 300);
  }, [medicineSearch]);

  async function handleDispense(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMedicineId || !clinicId) return;
    setDispensing(true);
    setError("");
    setSuccess("");
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("cliniqai_access_token") : null;
      const res = await fetch(`${BASE}/pharmacy/dispense`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prescriptionId, medicineId: selectedMedicineId, quantity, clinicId }),
      });
      if (res.ok) {
        setSuccess("Dispensed successfully");
        setSelectedMedicineId("");
        setMedicineSearch("");
        setQuantity(1);
        setShowForm(false);
        onSuccess();
      } else {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? "Dispense failed — check inventory");
      }
    } finally {
      setDispensing(false);
    }
  }

  if (!showForm) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
        >
          + Dispense Medicine
        </button>
        {success && <span className="text-xs text-green-600">{success}</span>}
      </div>
    );
  }

  return (
    <form onSubmit={handleDispense} className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
      <p className="text-xs font-medium text-gray-600 uppercase">Dispense Medicine</p>
      {!clinicId && (
        <p className="text-xs text-orange-600">Clinic not configured — dispensing may fail. Please log out and back in.</p>
      )}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={medicineSearch}
            onChange={(e) => { setMedicineSearch(e.target.value); setSelectedMedicineId(""); }}
            placeholder="Search medicine…"
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
          {medicines.length > 0 && !selectedMedicineId && (
            <div className="absolute z-10 w-full mt-1 rounded-lg border border-gray-200 bg-white shadow-lg">
              {medicines.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setSelectedMedicineId(m.id); setMedicineSearch(m.name + (m.strength ? ` ${m.strength}` : "")); setMedicines([]); }}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  {m.name} {m.strength && <span className="text-gray-400">{m.strength}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="Qty"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={dispensing || !selectedMedicineId}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {dispensing ? "Dispensing…" : "Dispense"}
        </button>
        <button type="button" onClick={() => setShowForm(false)} className="text-xs text-gray-500 hover:text-gray-700">
          Cancel
        </button>
      </div>
    </form>
  );
}

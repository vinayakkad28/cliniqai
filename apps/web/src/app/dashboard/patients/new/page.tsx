"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { patients } from "@/lib/api";

export default function NewPatientPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    phone: "",
    name: "",
    dateOfBirth: "",
    gender: "",
    address: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const patient = await patients.create({
        phone: form.phone,
        name: form.name,
        ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
        ...(form.gender ? { gender: form.gender } : {}),
        ...(form.address ? { address: form.address } : {}),
      });
      router.replace(`/dashboard/patients/${patient.id}`);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Failed to register patient");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Register New Patient</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <Field label="Mobile Number *" id="phone" type="tel" required value={form.phone} onChange={(v) => set("phone", v)} placeholder="+91 98765 43210" />
        <Field label="Full Name *" id="name" required value={form.name} onChange={(v) => set("name", v)} placeholder="Patient full name" />
        <Field label="Date of Birth" id="dob" type="date" value={form.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} />
        <div>
          <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
          <select
            id="gender"
            value={form.gender}
            onChange={(e) => set("gender", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="unknown">Prefer not to say</option>
          </select>
        </div>
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <textarea
            id="address"
            rows={3}
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="Street, City, State, PIN"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Registering…" : "Register Patient"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label, id, type = "text", required, value, onChange, placeholder,
}: {
  label: string; id: string; type?: string; required?: boolean;
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

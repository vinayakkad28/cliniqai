"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { patients } from "@/lib/api";
import { toast } from "sonner";
import FormField from "@/components/FormField";

export default function NewPatientPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    phone: "",
    name: "",
    dateOfBirth: "",
    gender: "",
    address: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.phone || form.phone.replace(/\D/g, "").length < 10) {
      errs.phone = "Enter a valid 10+ digit phone number";
    }
    if (!form.name.trim()) {
      errs.name = "Patient name is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const patient = await patients.create({
        phone: form.phone,
        name: form.name,
        ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
        ...(form.gender ? { gender: form.gender } : {}),
        ...(form.address ? { address: form.address } : {}),
      });
      toast.success("Patient registered successfully");
      router.replace(`/dashboard/patients/${patient.id}`);
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to register patient");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = (field: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
      errors[field] ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
    }`;

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-heading font-bold text-foreground">Register New Patient</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <FormField label="Mobile Number" htmlFor="phone" required error={errors.phone}>
          <input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+91 98765 43210"
            className={inputClass("phone")}
          />
        </FormField>

        <FormField label="Full Name" htmlFor="name" required error={errors.name}>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Patient full name"
            className={inputClass("name")}
          />
        </FormField>

        <FormField label="Date of Birth" htmlFor="dob">
          <input
            id="dob"
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => set("dateOfBirth", e.target.value)}
            className={inputClass("dateOfBirth")}
          />
        </FormField>

        <FormField label="Gender" htmlFor="gender">
          <select
            id="gender"
            value={form.gender}
            onChange={(e) => set("gender", e.target.value)}
            className={inputClass("gender")}
          >
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="unknown">Prefer not to say</option>
          </select>
        </FormField>

        <FormField label="Address" htmlFor="address">
          <textarea
            id="address"
            rows={3}
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="Street, City, State, PIN"
            className={inputClass("address")}
          />
        </FormField>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 cursor-pointer rounded-lg border border-border py-2.5 text-sm font-medium text-card-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {loading ? "Registering…" : "Register Patient"}
          </button>
        </div>
      </form>
    </div>
  );
}

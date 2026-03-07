"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { doctors, clinic, type ClinicProfile } from "@/lib/api";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type Day = typeof DAYS[number];

interface WorkingHour {
  id?: string;
  dayOfWeek: Day;
  startTime: string;
  endTime: string;
  slotDurationMins: number;
}

interface DoctorProfile {
  id: string;
  name?: string;
  bio?: string;
  specialties: string[];
  licenseNumber?: string;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<"profile" | "hours" | "clinic">("profile");
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Profile form state
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [specialtiesInput, setSpecialtiesInput] = useState("");

  // Clinic form state
  const [clinicData, setClinicData] = useState<ClinicProfile | null>(null);
  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [clinicGst, setClinicGst] = useState("");
  const [clinicLogo, setClinicLogo] = useState("");

  useEffect(() => {
    Promise.all([
      doctors.getMe(),
      doctors.getWorkingHours(),
      clinic.get(),
    ]).then(([doc, wh, cl]) => {
      const d = doc as DoctorProfile & { workingHours?: WorkingHour[] };
      setProfile(d);
      setName(d.name ?? "");
      setBio(d.bio ?? "");
      setLicenseNumber(d.licenseNumber ?? "");
      setSpecialtiesInput((d.specialties ?? []).join(", "));
      setHours((wh as WorkingHour[]) ?? []);
      const c = cl as ClinicProfile | null;
      if (c) {
        setClinicData(c);
        setClinicName(c.name ?? "");
        setClinicAddress(c.address ?? "");
        setClinicGst(c.gstNumber ?? "");
        setClinicLogo(c.logoUrl ?? "");
      }
    }).catch(() => null).finally(() => setLoading(false));
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);
    try {
      await doctors.patchMe({
        name: name || undefined,
        bio: bio || undefined,
        licenseNumber: licenseNumber || undefined,
        specialties: specialtiesInput.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError((e as { data?: { error?: string } }).data?.error ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(day: Day) {
    const existing = hours.find((h) => h.dayOfWeek === day);
    if (existing) {
      setHours(hours.filter((h) => h.dayOfWeek !== day));
    } else {
      setHours([...hours, { dayOfWeek: day, startTime: "09:00", endTime: "18:00", slotDurationMins: 15 }]);
    }
  }

  function updateHour(day: Day, field: keyof WorkingHour, value: string | number) {
    setHours(hours.map((h) => h.dayOfWeek === day ? { ...h, [field]: value } : h));
  }

  async function handleSaveHours(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);
    try {
      await doctors.putWorkingHours(hours.map(({ dayOfWeek, startTime, endTime, slotDurationMins }) => ({
        dayOfWeek, startTime, endTime, slotDurationMins,
      })));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError((e as { data?: { error?: string } }).data?.error ?? "Failed to save working hours");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveClinic(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);
    try {
      const updated = await clinic.patch({
        name: clinicName || undefined,
        address: clinicAddress || undefined,
        gstNumber: clinicGst || undefined,
        logoUrl: clinicLogo || undefined,
      }) as ClinicProfile;
      setClinicData(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError((e as { data?: { error?: string } }).data?.error ?? "Failed to save clinic info");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-20 text-center text-sm text-gray-400">Loading…</div>;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {(["profile", "hours", "clinic"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setError(""); setSaved(false); }}
            className={`rounded-md px-5 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "hours" ? "Working Hours" : t === "clinic" ? "Clinic" : "Profile"}
          </button>
        ))}
      </div>

      {/* ── Profile tab ── */}
      {tab === "profile" && (
        <form onSubmit={handleSaveProfile} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. Priya Sharma"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
            <input
              type="text"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="MCI/NMC registration number"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Specialties</label>
            <input
              type="text"
              value={specialtiesInput}
              onChange={(e) => setSpecialtiesInput(e.target.value)}
              placeholder="General Physician, Internal Medicine (comma-separated)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-400">Comma-separated list of specialties</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio <span className="text-gray-400">(optional)</span></label>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Brief introduction visible to patients…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
          {saved && <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">Profile saved successfully.</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </form>
      )}

      {/* ── Working Hours tab ── */}
      {tab === "hours" && (
        <form onSubmit={handleSaveHours} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <p className="text-sm text-gray-500">Select working days and set your clinic hours. Appointment slots will be generated based on these settings.</p>
          <div className="space-y-3">
            {DAYS.map((day) => {
              const h = hours.find((x) => x.dayOfWeek === day);
              const active = !!h;
              return (
                <div key={day} className={`rounded-lg border px-4 py-3 ${active ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"}`}>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer min-w-[130px]">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleDay(day)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700 capitalize">{day}</span>
                    </label>
                    {active && h && (
                      <>
                        <div className="flex items-center gap-2">
                          <input type="time" value={h.startTime} onChange={(e) => updateHour(day, "startTime", e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none" />
                          <span className="text-xs text-gray-400">to</span>
                          <input type="time" value={h.endTime} onChange={(e) => updateHour(day, "endTime", e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none" />
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <select value={h.slotDurationMins} onChange={(e) => updateHour(day, "slotDurationMins", parseInt(e.target.value))} className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none">
                            {[5, 10, 15, 20, 30, 45, 60].map((m) => (
                              <option key={m} value={m}>{m} min slots</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
          {saved && <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">Working hours saved.</p>}
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Saving…" : "Save Working Hours"}
          </button>
        </form>
      )}

      {/* ── Clinic tab ── */}
      {tab === "clinic" && (
        <form onSubmit={handleSaveClinic} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <p className="text-sm text-gray-500">
            Clinic details appear on invoices and receipts printed for patients.
            {!clinicData && <span className="ml-1 font-medium text-blue-600">No clinic configured yet — fill in the fields below to create one.</span>}
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clinic Name</label>
            <input
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="City Health Clinic"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              rows={3}
              value={clinicAddress}
              onChange={(e) => setClinicAddress(e.target.value)}
              placeholder="123 MG Road, Bengaluru, Karnataka - 560001"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GST Number <span className="text-gray-400">(optional)</span></label>
            <input
              type="text"
              value={clinicGst}
              onChange={(e) => setClinicGst(e.target.value)}
              placeholder="29AABCU9603R1Z2"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-400">Printed on GST-compliant invoices</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL <span className="text-gray-400">(optional)</span></label>
            <input
              type="url"
              value={clinicLogo}
              onChange={(e) => setClinicLogo(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
          {saved && <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">Clinic info saved successfully.</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : clinicData ? "Save Clinic Info" : "Create Clinic"}
          </button>
        </form>
      )}

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">Team</h2>
        <p className="mb-3 text-sm text-gray-500">Add nurses, receptionists, and admins to your clinic.</p>
        <Link
          href="/dashboard/settings/staff"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          👥 Manage Staff
        </Link>
      </div>

      {profile && (
        <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-xs text-gray-400">
          Doctor ID: <span className="font-mono">{profile.id}</span>
        </div>
      )}
    </div>
  );
}

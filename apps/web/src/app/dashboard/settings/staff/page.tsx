"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { staff, type StaffMember } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  nurse: "Nurse",
  receptionist: "Receptionist",
  admin: "Admin",
};

const ROLE_COLORS: Record<string, string> = {
  nurse: "bg-teal-100 text-teal-700",
  receptionist: "bg-blue-100 text-blue-700",
  admin: "bg-purple-100 text-purple-700",
};

export default function StaffPage() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"nurse" | "receptionist" | "admin">("nurse");
  const [creating, setCreating] = useState(false);
  const [setupCode, setSetupCode] = useState<{ code: string; phone: string } | null>(null);
  const [createError, setCreateError] = useState("");

  // Remove
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    staff.list()
      .then((r) => setMembers(r.data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setCreateError(""); setSetupCode(null);
    try {
      const created = await staff.create({ phone, name, role });
      setMembers((prev) => [...prev, created]);
      setSetupCode({ code: created.setupCode, phone: created.phone });
      setPhone(""); setName(""); setRole("nurse");
    } catch (err: unknown) {
      setCreateError((err as { data?: { error?: string } }).data?.error ?? "Failed to create staff account");
    } finally {
      setCreating(false);
    }
  }

  async function handleRemove(member: StaffMember) {
    if (!confirm(`Deactivate ${member.name ?? member.phone}? They will no longer be able to log in.`)) return;
    setRemovingId(member.id);
    try {
      await staff.remove(member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch {
      // silent
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-sm text-gray-500 hover:text-gray-900">← Settings</Link>
        <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
      </div>

      {/* Add staff form */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wide">Add Staff Member</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Priya Sharma"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919876543210"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="nurse">Nurse — patient care, appointments, vitals</option>
              <option value="receptionist">Receptionist — scheduling and patient registration</option>
              <option value="admin">Admin — billing, reports, pharmacy</option>
            </select>
          </div>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create Staff Account"}
          </button>
        </form>
      </div>

      {/* Setup code display */}
      {setupCode && (
        <div className="mb-8 rounded-xl border border-green-200 bg-green-50 p-5">
          <p className="mb-1 font-semibold text-green-800">✓ Staff account created!</p>
          <p className="text-sm text-green-700 mb-3">
            Share this one-time setup code with <span className="font-mono font-semibold">{setupCode.phone}</span>.
            They can use it to log in for the first time via OTP.
          </p>
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-white border border-green-300 px-4 py-2 font-mono text-2xl font-bold tracking-widest text-green-800">
              {setupCode.code}
            </span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(setupCode.code)}
              className="rounded-lg border border-green-300 px-3 py-2 text-sm text-green-700 hover:bg-green-100"
            >
              Copy
            </button>
          </div>
          <p className="mt-2 text-xs text-green-600">This code expires in 7 days.</p>
          <button type="button" onClick={() => setSetupCode(null)} className="mt-3 text-xs text-green-500 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Staff list */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Current Staff</h2>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : members.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No staff members yet. Add a nurse, receptionist, or admin above.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "Phone", "Role", "Added", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{m.name ?? "—"}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-700">{m.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[m.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(m.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleRemove(m)}
                      disabled={removingId === m.id}
                      className="text-xs text-red-500 hover:underline disabled:opacity-50"
                    >
                      {removingId === m.id ? "Removing…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { patients, type Patient } from "@/lib/api";
import { TableSkeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { UsersIcon } from "@heroicons/react/24/outline";

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{ data: Patient[]; meta: { total: number; pages: number } } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    patients
      .list({ ...(query ? { search: query } : {}), page, limit: 20 })
      .then((r) => setData(r as { data: Patient[]; meta: { total: number; pages: number } }))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [query, page]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQuery(search);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-foreground">Patients</h1>
        <Link
          href="/dashboard/patients/new"
          className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          + Register Patient
        </Link>
      </div>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          type="search"
          placeholder="Search by phone or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search patients"
          className="flex-1 rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          className="cursor-pointer rounded-lg bg-muted px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted/80"
        >
          Search
        </button>
      </form>

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : !data?.data.length ? (
        <EmptyState
          icon={<UsersIcon className="h-8 w-8 text-muted-foreground" />}
          title={query ? "No patients found" : "No patients yet"}
          description={query ? "Try a different search term" : "Register your first patient to get started"}
          actionLabel={query ? undefined : "Register Patient"}
          actionHref={query ? undefined : "/dashboard/patients/new"}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  {["Name", "Phone", "Tags", "Registered", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.data.map((pt) => (
                  <tr key={pt.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium text-card-foreground">{pt.name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{pt.phone}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {pt.tags.map(({ tag }) => (
                          <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(pt.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/patients/${pt.id}`}
                        className="text-xs text-primary hover:underline cursor-pointer"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>{data.meta.total} patient{data.meta.total !== 1 ? "s" : ""}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="cursor-pointer rounded px-2 py-1 disabled:opacity-40 hover:bg-muted"
              >
                ← Prev
              </button>
              <span>Page {page} / {data.meta.pages}</span>
              <button
                disabled={page >= data.meta.pages}
                onClick={() => setPage((p) => p + 1)}
                className="cursor-pointer rounded px-2 py-1 disabled:opacity-40 hover:bg-muted"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

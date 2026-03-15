"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon } from "@heroicons/react/20/solid";

const LABEL_MAP: Record<string, string> = {
  dashboard: "Dashboard",
  patients: "Patients",
  appointments: "Appointments",
  consultations: "Consultations",
  billing: "Billing",
  pharmacy: "Pharmacy",
  settings: "Settings",
  new: "New",
  documents: "Documents",
  intelligence: "AI Intelligence",
  imaging: "AI Imaging",
  prescriptions: "Prescriptions",
  labs: "Lab Orders",
  invoice: "Invoice",
  discharge: "Discharge",
  staff: "Staff",
  invoices: "Invoices",
  print: "Print",
};

function formatSegment(segment: string): string {
  if (LABEL_MAP[segment]) return LABEL_MAP[segment];
  // UUID: show first 8 chars
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(segment)) return `#${segment.slice(0, 8)}`;
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Don't show breadcrumbs on dashboard root
  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, i) => ({
    label: formatSegment(seg),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-1">
            {crumb.isLast ? (
              <span className="font-medium text-card-foreground" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <>
                <Link
                  href={crumb.href}
                  className="hover:text-primary transition-colors"
                >
                  {crumb.label}
                </Link>
                <ChevronRightIcon className="h-4 w-4 shrink-0" />
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

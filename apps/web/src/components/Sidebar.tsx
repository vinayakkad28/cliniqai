"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  HomeIcon,
  CalendarDaysIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  CreditCardIcon,
  BeakerIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  BellAlertIcon,
  ChartBarIcon,
  QueueListIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: HomeIcon },
  { href: "/dashboard/appointments", label: "Appointments", Icon: CalendarDaysIcon },
  { href: "/dashboard/patients", label: "Patients", Icon: UsersIcon },
  { href: "/dashboard/consultations", label: "Consultations", Icon: ClipboardDocumentListIcon },
  { href: "/dashboard/billing", label: "Billing", Icon: CreditCardIcon },
  { href: "/dashboard/pharmacy", label: "Pharmacy", Icon: BeakerIcon },
  { href: "/dashboard/follow-ups", label: "Follow-ups", Icon: BellAlertIcon },
  { href: "/dashboard/analytics", label: "Analytics", Icon: ChartBarIcon },
  { href: "/dashboard/queue", label: "Queue Display", Icon: QueueListIcon },
  { href: "/dashboard/audit-log", label: "Audit Log", Icon: DocumentTextIcon },
  { href: "/dashboard/settings", label: "Settings", Icon: Cog6ToothIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const sidebarContent = (
    <>
      <div className="px-6 py-5 border-b border-border">
        <span className="text-xl font-heading font-bold text-primary">CliniqAI</span>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <div className="mb-2">
          <p className="text-sm font-medium text-card-foreground truncate">
            {user?.doctor?.name ?? user?.phone}
          </p>
          <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full cursor-pointer rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Log out of CliniqAI"
        >
          Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center border-b border-border bg-card px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Open navigation menu"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
        <span className="ml-3 text-lg font-heading font-bold text-primary">CliniqAI</span>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 flex h-screen w-64 flex-col bg-card shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 cursor-pointer rounded-lg p-1 text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Close navigation menu"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex h-screen w-56 flex-col border-r border-border bg-card">
        {sidebarContent}
      </aside>
    </>
  );
}

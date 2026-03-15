"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { useRealtime } from "@/lib/realtime";
import Sidebar from "@/components/Sidebar";
import ErrorBoundary from "@/components/ErrorBoundary";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Skeleton } from "@/components/Skeleton";
import { CommandPalette } from "@/components/CommandPalette";
import { NotificationBell } from "@/components/NotificationBell";
import { InstallPrompt } from "@/components/InstallPrompt";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, token } = useAuth();
  const router = useRouter();

  // Keyboard shortcuts (g+p, g+a, n+p, etc.)
  useKeyboardShortcuts();

  // Real-time updates via SSE
  useRealtime(token);

  // Register service worker for PWA
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-card/80 backdrop-blur-sm border-b border-border flex items-center justify-between px-6 shrink-0 lg:flex hidden">
          <div />
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
                window.dispatchEvent(event);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm text-muted-foreground hover:bg-muted/80 border border-border transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
              <kbd className="ml-2 px-1.5 py-0.5 text-2xs bg-card border border-border rounded text-muted-foreground">⌘K</kbd>
            </button>
            <NotificationBell />
          </div>
        </header>
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-6 pt-20 lg:pt-6"
        >
          <Breadcrumbs />
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
      <CommandPalette />
      <InstallPrompt />
    </div>
  );
}

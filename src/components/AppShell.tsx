"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import type { NotificationRecord } from "@/server/platform/types";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { mode, user, loading, logout } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (mode !== "SERVER" || !user) return;
    void fetch("/api/notifications", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { items: [] })
      .then((body: { items: NotificationRecord[] }) => setNotifications(body.items));
  }, [mode, user]);

  if (pathname === "/login") {
    return <main className="min-h-screen bg-surface-primary">{children}</main>;
  }
  if (mode === "SERVER" && loading) {
    return <main className="min-h-screen bg-surface-primary flex items-center justify-center text-text-secondary">Loading secure workspace...</main>;
  }
  if (mode === "SERVER" && !user) {
    return <main className="min-h-screen bg-surface-primary flex items-center justify-center text-text-secondary">Redirecting to sign in...</main>;
  }

  const navigation = [
    { name: "Upload", href: "/upload", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
    { name: "Dashboard", href: "/dashboard", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
    { name: "Exceptions", href: "/exceptions", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
  ];
  if (mode === "SERVER") {
    navigation.push(
      { name: "My Queue", href: "/my-queue", icon: "M5 13l4 4L19 7" },
      { name: "Batches", href: "/batches", icon: "M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5" },
      { name: "Reports", href: "/reports", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5l5 5v11a2 2 0 01-2 2z" },
    );
  } else {
    navigation.push({ name: "Finance Admin", href: "/admin/policies", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04" });
  }
  if (user?.role === "ADMIN") {
    navigation.push(
      { name: "Policies", href: "/admin/policies", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04" },
      { name: "Team", href: "/admin/team", icon: "M17 20h5v-2a4 4 0 00-4-4h-1M9 20H2v-2a4 4 0 014-4h3m4-4a4 4 0 10-8 0 4 4 0 008 0z" },
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface-primary overflow-hidden">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn-primary">Skip to content</a>
      {/* Sidebar */}
      <nav className="w-full md:w-72 bg-surface-secondary border-b md:border-b-0 md:border-r border-border-subtle flex flex-col z-20 shrink-0">
        <div className="p-6 md:p-8">
          <Link href="/dashboard" className="block hover:opacity-80 transition-opacity max-w-[160px]">
            <Image 
              src="/brand/hisaab-kitaab-logo.png" 
              alt="hisaabकिताब" 
              width={160} 
              height={120} 
              className="w-full h-auto"
              priority
            />
          </Link>
          <p className="mt-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">
            Review exceptions. Not every invoice.
          </p>
        </div>
        
        <div className="px-4 py-4 flex-1 flex flex-row md:flex-col gap-2 overflow-x-auto custom-scrollbar">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-[200ms] ease-[cubic-bezier(.22,1,.36,1)] flex items-center gap-3 ${
                  isActive
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
                }`}
              >
                <svg className="w-5 h-5 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.name}
              </Link>
            );
          })}
        </div>
        
        {/* Authenticated context remains available in Server mode only. */}
        {mode === "SERVER" && user && <div className="p-6 border-t border-border-subtle mt-auto hidden md:flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-elevated border border-border-subtle flex items-center justify-center text-text-primary font-bold">
            {(user?.displayName ?? "Local Demo").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary truncate">{user?.displayName ?? "Local Demo"}</p>
            <p className="text-xs text-text-secondary">{user?.role.replaceAll("_", " ") ?? "Browser workspace"}</p>
          </div>
          <button type="button" onClick={() => void logout()} className="text-xs text-text-muted hover:text-text-primary">Logout</button>
        </div>}
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Top Utility / Context Bar */}
        <header className="h-16 border-b border-border-subtle bg-surface-primary flex items-center justify-between px-6 md:px-10 shrink-0 z-10">
          <div className="flex items-center gap-4">
             <div className="text-xs font-medium text-text-secondary px-2.5 py-1 rounded-full border border-border-subtle bg-surface-elevated">
               Environment: {mode === "SERVER" ? "Server" : "Local Demo"}
             </div>
          </div>
          <div className="flex items-center gap-4 relative">
             <button aria-label="Notifications" aria-expanded={showNotifications} onClick={() => setShowNotifications((visible) => !visible)} className="text-text-secondary hover:text-text-primary transition-colors relative">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
               </svg>
               {notifications.length > 0 && <span className="absolute -right-2 -top-2 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-white font-bold">{Math.min(notifications.length, 99)}</span>}
             </button>
             {showNotifications && <div className="absolute right-0 top-9 w-80 card overflow-hidden shadow-sm z-50"><p className="px-4 py-3 font-bold border-b border-border-subtle">Notifications</p>{notifications.length === 0 ? <p className="p-4 text-sm text-text-secondary">No notifications.</p> : notifications.slice(0, 8).map((notification) => <div key={notification.id} className="px-4 py-3 border-b border-border-subtle last:border-0"><p className="text-sm font-semibold">{notification.title}</p><p className="text-xs text-text-secondary mt-1">{notification.message}</p><p className="text-[10px] text-text-muted mt-1">{new Date(notification.createdAt).toLocaleString()}</p></div>)}</div>}
          </div>
        </header>

        {/* Page Content */}
        <main id="main-content" className="flex-1 overflow-y-auto z-10 relative custom-scrollbar bg-surface-primary">
          <div className="p-6 md:p-10 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

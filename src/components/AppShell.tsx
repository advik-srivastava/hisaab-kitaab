"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navigation = [
    { name: "Upload", href: "/upload" },
    { name: "Dashboard", href: "/dashboard" },
    { name: "Exceptions", href: "/exceptions" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar / Header */}
      <nav className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex-shrink-0">
        <div className="p-6 mb-2">
          <Link href="/dashboard" className="flex items-center gap-2 mb-2 hover:opacity-90 transition-opacity">
            <span className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              hisaab<span className="text-blue-600">किताब</span>
            </span>
          </Link>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Review exceptions. Not every invoice.
          </p>
        </div>
        <div className="px-4 py-2 flex flex-row md:flex-col gap-1 overflow-x-auto">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center ${
                  isActive
                    ? "bg-blue-50/80 text-blue-700 shadow-sm ring-1 ring-blue-700/10"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { loadStateAsync, type PersistedState } from "@/lib/storage";
import { DecisionStatus } from "@/types/decisions";

export default function DashboardPage() {
  const [state, setState] = useState<PersistedState | null>(null);

  useEffect(() => {
    let active = true;
    void loadStateAsync().then((loaded) => {
      if (active) setState(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!state) {
    return (
      <div className="flex justify-center p-12">
        <div className="text-slate-500">Loading dashboard...</div>
      </div>
    );
  }

  const batch = state.currentBatch;

  if (!batch) {
    return (
      <div className="max-w-3xl mx-auto mt-12">
        <div className="bg-white border border-slate-200/75 rounded-xl p-12 text-center shadow-sm flex flex-col items-center">
          <svg className="w-12 h-12 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h2 className="text-xl font-bold text-slate-900 mb-2">No analyzed batch yet</h2>
          <p className="text-sm text-slate-500 mb-8 max-w-sm">Upload a Finance batch to identify exceptions and possible duplicate transactions.</p>
          <Link
            href="/upload"
            className="inline-flex justify-center rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            Upload Invoice Batch
          </Link>
        </div>
      </div>
    );
  }

  const { batchSummary, transactions, decisions } = batch;
  
  const summary = batchSummary || {
    totalProcessed: 0,
    autoPassed: 0,
    needsReview: 0,
    highRisk: 0,
    duplicateCandidates: 0,
    potentialExposure: 0
  };

  const total = summary.totalProcessed;
  const autoPassPct = total > 0 ? (summary.autoPassed / total) * 100 : 0;
  const reviewPct = total > 0 ? (summary.needsReview / total) * 100 : 0;
  const highRiskPct = total > 0 ? (summary.highRisk / total) * 100 : 0;

  const priorityExceptions = transactions
    .filter((t) => {
      const status = decisions[t.id]?.status;
      return status === "HIGH_RISK" || status === "REVIEW";
    })
    .sort((a, b) => {
      const aStatus = decisions[a.id]?.status;
      const bStatus = decisions[b.id]?.status;
      if (aStatus === "HIGH_RISK" && bStatus !== "HIGH_RISK") return -1;
      if (bStatus === "HIGH_RISK" && aStatus !== "HIGH_RISK") return 1;
      return a.id.localeCompare(b.id); // stable sort
    })
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="mt-2 text-base text-slate-600">
          Overview of the latest analyzed batch.
        </p>
      </div>

      {/* Visual Summary */}
      <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200/75 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-1">
          Batch Summary
        </h3>
        <p className="text-sm text-slate-600 mb-8 font-medium">
          <span className="font-bold text-slate-900">{summary.autoPassed}</span> transactions cleared automatically. <span className="font-bold text-slate-900">{summary.needsReview + summary.highRisk}</span> exceptions require Finance attention.
        </p>
        <div className="relative">
          <div className="flex h-10 rounded-lg overflow-hidden bg-slate-100 ring-1 ring-inset ring-slate-200/50">
            <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${autoPassPct}%` }} title={`Auto Pass (${summary.autoPassed})`}></div>
            <div className="bg-amber-400 transition-all duration-500" style={{ width: `${reviewPct}%` }} title={`Review (${summary.needsReview})`}></div>
            <div className="bg-red-500 transition-all duration-500" style={{ width: `${highRiskPct}%` }} title={`High Risk (${summary.highRisk})`}></div>
          </div>
          <div className="flex justify-between text-sm font-medium text-slate-600 mt-4 px-1">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm"></span>
              Auto Pass ({summary.autoPassed})
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block shadow-sm"></span>
              Review ({summary.needsReview})
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block shadow-sm"></span>
              High Risk ({summary.highRisk})
            </span>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard title="Total Processed" value={summary.totalProcessed} />
        <MetricCard title="Auto-cleared" value={summary.autoPassed} />
        <MetricCard title="Needs Review" value={summary.needsReview} />
        <MetricCard title="High Risk" value={summary.highRisk} />
        <div className="opacity-80">
          <MetricCard title="Duplicate Candidates" value={summary.duplicateCandidates} />
        </div>
        <div className="opacity-80">
          <MetricCard title="Potential Exposure" value={summary.potentialExposure} isCurrency />
        </div>
      </div>

      {/* Priority Exceptions */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-slate-900">
            Priority Exceptions
          </h2>
          <Link
            href="/exceptions"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-all"
          >
            View all exceptions &rarr;
          </Link>
        </div>
        <div className="bg-white border border-slate-200/75 rounded-xl shadow-sm overflow-hidden">
          {priorityExceptions.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500 flex flex-col items-center">
              <svg className="w-12 h-12 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              No priority exceptions found.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {priorityExceptions.map((ex) => {
                const decision = decisions[ex.id];
                return (
                  <li key={ex.id} className="group hover:bg-slate-50/80 transition-colors">
                    <Link href={`/exceptions/${ex.id}`} className="block p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <StatusBadge status={decision.status as DecisionStatus} />
                          <div>
                            <div className="flex items-center gap-3">
                              <p className="text-sm font-semibold text-slate-900">
                                {ex.invoiceNumber || "Unknown"}
                              </p>
                              <span className="text-slate-300 text-xs">&bull;</span>
                              <p className="text-sm font-medium text-slate-600">
                                {ex.vendorName || "Unknown"}
                              </p>
                            </div>
                            <p className="text-sm text-slate-500 mt-1 line-clamp-1">
                              {decision.headline || "Requires review"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-5">
                          <div className="text-sm font-semibold text-slate-900 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-100">
                            {typeof ex.amount === "number" && Number.isFinite(ex.amount)
                              ? `₹${ex.amount.toLocaleString()}`
                              : "-"}
                          </div>
                          <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

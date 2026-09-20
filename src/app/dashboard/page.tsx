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
        <div className="text-text-secondary animate-pulse">Loading dashboard...</div>
      </div>
    );
  }

  const batch = state.currentBatch;

  if (!batch) {
    return (
      <div className="max-w-3xl mx-auto mt-12 relative z-10">
        <div className="card p-12 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-panel border border-panel-border rounded-full flex items-center justify-center mb-6 shadow-inner">
            <svg className="w-10 h-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-3">No analyzed batch yet</h2>
          <p className="text-sm text-text-secondary mb-8 max-w-sm">Upload a Finance batch to identify exceptions and possible duplicate transactions.</p>
          <Link
            href="/upload"
            className="btn-primary"
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
    <div className="space-y-8 relative z-10 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Dashboard</h1>
        <p className="mt-2 text-base text-text-secondary">
          Overview of the latest analyzed batch.
        </p>
      </div>

      {/* Visual Summary */}
      <div className="card p-6 md:p-8">
        <h3 className="text-lg font-bold text-text-primary mb-2">
          Batch Summary
        </h3>
        <p className="text-sm text-text-secondary mb-8">
          <span className="font-bold text-text-primary">{summary.autoPassed}</span> transactions cleared automatically. <span className="font-bold text-brand-primary">{summary.needsReview + summary.highRisk}</span> exceptions require Finance attention.
        </p>
        <div className="relative">
          <div className="flex h-12 rounded-xl overflow-hidden bg-panel border border-panel-border shadow-inner">
            <div className="bg-emerald-500/90 hover:bg-emerald-400 transition-all duration-[320ms] ease-[cubic-bezier(.22,1,.36,1)] shadow-[0_0_20px_rgba(16,185,129,0.2)]" style={{ width: `${autoPassPct}%` }} title={`Auto Pass (${summary.autoPassed})`}></div>
            <div className="bg-amber-500/90 hover:bg-amber-400 transition-all duration-[320ms] ease-[cubic-bezier(.22,1,.36,1)] shadow-[0_0_20px_rgba(245,158,11,0.2)]" style={{ width: `${reviewPct}%` }} title={`Review (${summary.needsReview})`}></div>
            <div className="bg-red-500/90 hover:bg-red-400 transition-all duration-[320ms] ease-[cubic-bezier(.22,1,.36,1)] shadow-[0_0_20px_rgba(239,68,68,0.2)]" style={{ width: `${highRiskPct}%` }} title={`High Risk (${summary.highRisk})`}></div>
          </div>
          <div className="flex justify-between text-sm font-semibold text-text-secondary mt-4 px-2">
            <span className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
              Auto Pass ({summary.autoPassed})
            </span>
            <span className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></span>
              Review ({summary.needsReview})
            </span>
            <span className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></span>
              High Risk ({summary.highRisk})
            </span>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
        <MetricCard title="Total Processed" value={summary.totalProcessed} />
        <MetricCard title="Auto-cleared" value={summary.autoPassed} />
        <MetricCard title="Needs Review" value={summary.needsReview} />
        <MetricCard title="High Risk" value={summary.highRisk} />
        <div className="opacity-90">
          <MetricCard title="Duplicate Candidates" value={summary.duplicateCandidates} />
        </div>
        <div className="opacity-90">
          <MetricCard title="Potential Exposure" value={summary.potentialExposure} isCurrency />
        </div>
      </div>

      {/* Priority Exceptions */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-5 px-1">
          <h2 className="text-xl font-bold text-text-primary">
            Priority Exceptions
          </h2>
          <Link
            href="/exceptions"
            className="text-sm font-semibold text-brand-primary hover:text-blue-400 transition-colors flex items-center gap-1"
          >
            View all exceptions
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        <div className="card overflow-hidden">
          {priorityExceptions.length === 0 ? (
            <div className="p-12 text-center text-sm text-text-secondary flex flex-col items-center">
              <div className="w-16 h-16 bg-panel border border-panel-border rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-status-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-semibold text-text-primary text-base mb-1">Zero Priority Exceptions</p>
              <p>Everything looks clean and compliant.</p>
            </div>
          ) : (
            <ul className="divide-y divide-panel-border/30">
              {priorityExceptions.map((ex) => {
                const decision = decisions[ex.id];
                return (
                  <li key={ex.id} className="group hover:bg-panel-hover transition-colors duration-200">
                    <Link href={`/exceptions/${ex.id}`} className="block p-5 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <StatusBadge status={decision.status as DecisionStatus} />
                          <div>
                            <div className="flex items-center gap-3">
                              <p className="text-sm font-bold text-text-primary truncate max-w-[100px] sm:max-w-[150px] lg:max-w-[200px]">
                                {ex.invoiceNumber || "Unknown"}
                              </p>
                              <span className="text-text-muted text-xs flex-shrink-0">&bull;</span>
                              <p className="text-sm font-semibold text-text-secondary truncate max-w-[100px] sm:max-w-[150px] lg:max-w-[200px]">
                                {ex.vendorName || "Unknown"}
                              </p>
                            </div>
                            <p className="text-sm text-text-muted mt-1.5 line-clamp-1">
                              {decision.headline || "Requires review"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-sm font-bold text-text-primary bg-panel px-4 py-2 rounded-lg border border-panel-border shadow-inner">
                            {typeof ex.amount === "number" && Number.isFinite(ex.amount)
                              ? `₹${ex.amount.toLocaleString()}`
                              : "-"}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-panel border border-panel-border flex items-center justify-center group-hover:bg-brand-primary group-hover:border-brand-primary group-hover:text-white transition-all text-text-muted">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
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

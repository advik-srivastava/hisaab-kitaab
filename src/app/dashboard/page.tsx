"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { loadStateAsync, type PersistedState } from "@/lib/storage";
import { DecisionStatus } from "@/types/decisions";
import { ServerDashboard } from "@/components/ServerDashboard";

export default function DashboardPage() {
  return process.env.NEXT_PUBLIC_APP_MODE === "SERVER" ? <ServerDashboard /> : <LocalDashboardPage />;
}

function LocalDashboardPage() {
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
        {batch.policySnapshot && <p className="mt-3 text-xs font-bold text-brand-primary">Policy: {batch.policySnapshot.policyName} v{batch.policySnapshot.version}</p>}
      </div>

      {/* Hero Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-8 lg:col-span-2 flex flex-col justify-center relative overflow-hidden bg-gradient-to-br from-panel to-slate-50 border-brand-primary/10">
          <div className="relative z-10">
            <h3 className="text-xs font-bold text-brand-primary uppercase tracking-widest mb-4">
              Workload Reduction
            </h3>
            <div className="text-4xl md:text-5xl font-bold text-text-primary mb-3 tracking-tight">
              {summary.autoPassed.toLocaleString()} <span className="text-2xl text-text-muted font-normal tracking-normal">cleared automatically</span>
            </div>
            <p className="text-base text-text-secondary mb-10 max-w-xl">
              <strong className="text-brand-primary font-semibold">{summary.needsReview + summary.highRisk}</strong> exceptions require Finance attention out of {summary.totalProcessed.toLocaleString()} total transactions.
            </p>
            
            <div className="relative">
              <div className="flex h-6 rounded-md overflow-hidden bg-panel border border-panel-border shadow-sm">
                <div className="bg-status-success-text hover:bg-emerald-500 transition-all duration-[320ms] ease-[cubic-bezier(.22,1,.36,1)]" style={{ width: `${autoPassPct}%` }} title={`Auto Pass (${summary.autoPassed})`}></div>
                <div className="bg-status-warning-text hover:bg-amber-400 transition-all duration-[320ms] ease-[cubic-bezier(.22,1,.36,1)]" style={{ width: `${reviewPct}%` }} title={`Review (${summary.needsReview})`}></div>
                <div className="bg-status-danger-text hover:bg-red-400 transition-all duration-[320ms] ease-[cubic-bezier(.22,1,.36,1)]" style={{ width: `${highRiskPct}%` }} title={`High Risk (${summary.highRisk})`}></div>
              </div>
              <div className="flex justify-between text-xs font-bold text-text-muted mt-3 px-1 uppercase tracking-wider">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-status-success-text"></span>
                  Auto Pass
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-status-warning-text"></span>
                  Review
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-status-danger-text"></span>
                  High Risk
                </span>
              </div>
            </div>
          </div>
          {/* Subtle Background Accent */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-brand-primary/[0.03] rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        </div>

        <div className="card p-8 flex flex-col justify-center bg-brand-primary text-white border-brand-primary shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xs font-bold text-brand-secondary uppercase tracking-widest mb-6">
              Key Metrics
            </h3>
            <div className="space-y-8">
              <div>
                <p className="text-sm text-white/70 mb-1">Total Processed</p>
                <p className="text-4xl font-bold text-white">{summary.totalProcessed.toLocaleString()}</p>
              </div>
              <div className="pt-8 border-t border-white/10">
                <p className="text-sm text-white/70 mb-1">Potential Exposure</p>
                <p className="text-4xl font-bold text-white">
                  ₹{summary.potentialExposure.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-2xl -mr-10 -mb-10 pointer-events-none"></div>
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
      <div className="mt-12">
        <div className="flex items-center justify-between mb-6 px-1">
          <h2 className="text-xl font-heading font-bold text-text-primary tracking-tight">
            Priority Exceptions
          </h2>
          <Link
            href="/exceptions"
            className="text-sm font-semibold text-brand-primary hover:text-brand-primary/80 transition-colors flex items-center gap-1"
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
              <div className="w-16 h-16 bg-status-success-bg border border-status-success-border rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-status-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-bold text-text-primary text-base mb-1">Zero Priority Exceptions</p>
              <p>Everything looks clean and compliant.</p>
            </div>
          ) : (
            <ul className="divide-y divide-panel-border/60">
              {priorityExceptions.map((ex) => {
                const decision = decisions[ex.id];
                return (
                  <li key={ex.id} className="group hover:bg-panel-hover transition-colors duration-[180ms] ease-[cubic-bezier(.22,1,.36,1)]">
                    <Link href={`/exceptions/${ex.id}`} className="block p-5 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <StatusBadge status={decision.status as DecisionStatus} />
                          <div>
                            <div className="flex items-center gap-3">
                              <p className="text-sm font-bold text-text-primary truncate max-w-[100px] sm:max-w-[150px] lg:max-w-[200px]">
                                {ex.invoiceNumber || "Unknown"}
                              </p>
                              <span className="text-text-muted/50 text-xs flex-shrink-0">&bull;</span>
                              <p className="text-sm font-medium text-text-secondary truncate max-w-[100px] sm:max-w-[150px] lg:max-w-[200px]">
                                {ex.vendorName || "Unknown"}
                              </p>
                            </div>
                            <p className="text-sm text-text-muted mt-1 line-clamp-1">
                              {decision.headline || "Requires review"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-base font-heading font-semibold text-text-primary">
                            {typeof ex.amount === "number" && Number.isFinite(ex.amount)
                              ? `₹${ex.amount.toLocaleString()}`
                              : "-"}
                          </div>
                          <div className="text-brand-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-[240ms] ease-[cubic-bezier(.22,1,.36,1)]">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { loadState, type PersistedState } from "@/lib/storage";
import { DecisionStatus } from "@/types/decisions";

export default function DashboardPage() {
  const [state, setState] = useState<PersistedState | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
  }, []);

  if (!state) {
    return (
      <div className="flex justify-center p-12">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  const batch = state.currentBatch;

  if (!batch) {
    return (
      <div className="max-w-3xl mx-auto mt-10">
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">No analyzed batch yet.</h2>
          <p className="text-sm text-slate-500 mb-6">Upload a CSV or Excel file to get started.</p>
          <Link
            href="/upload"
            className="inline-flex justify-center rounded-md bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
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
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of the latest analyzed batch.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard title="Total Processed" value={summary.totalProcessed} />
        <MetricCard title="Auto-cleared" value={summary.autoPassed} />
        <MetricCard title="Needs Review" value={summary.needsReview} />
        <MetricCard title="High Risk" value={summary.highRisk} />
        <MetricCard title="Duplicate Candidates" value={summary.duplicateCandidates} />
        <MetricCard title="Potential Exposure" value={summary.potentialExposure} isCurrency />
      </div>

      {/* Visual Summary */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <h3 className="text-base font-medium text-slate-900 mb-4">
          Processed Transactions
        </h3>
        <div className="flex h-8 rounded-full overflow-hidden bg-slate-100">
          <div className="bg-green-500" style={{ width: `${autoPassPct}%` }} title={`Auto Pass (${summary.autoPassed})`}></div>
          <div className="bg-amber-400" style={{ width: `${reviewPct}%` }} title={`Review (${summary.needsReview})`}></div>
          <div className="bg-red-500" style={{ width: `${highRiskPct}%` }} title={`High Risk (${summary.highRisk})`}></div>
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-2">
          <span>Auto Pass ({summary.autoPassed})</span>
          <span>Review ({summary.needsReview})</span>
          <span>High Risk ({summary.highRisk})</span>
        </div>
      </div>

      {/* Priority Exceptions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-slate-900">
            Priority Exceptions
          </h2>
          <Link
            href="/exceptions"
            className="text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            View all exceptions &rarr;
          </Link>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          {priorityExceptions.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No priority exceptions found.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {priorityExceptions.map((ex) => {
                const decision = decisions[ex.id];
                return (
                  <li key={ex.id} className="p-4 hover:bg-slate-50">
                    <Link href={`/exceptions/${ex.id}`} className="block">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <StatusBadge status={decision.status as DecisionStatus} />
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {ex.invoiceNumber || "Unknown"} - {ex.vendorName || "Unknown"}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {decision.headline || "Requires review"}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-slate-900">
                          {ex.amount ? `₹${ex.amount.toLocaleString()}` : "-"}
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

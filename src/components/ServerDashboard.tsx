"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MetricCard } from "./MetricCard";
import { StatusBadge } from "./StatusBadge";
import type { BatchHistoryItem, ExceptionPage } from "@/server/platform/types";

export function ServerDashboard() {
  const [data, setData] = useState<{ batch?: BatchHistoryItem; exceptions: ExceptionPage }>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch("/api/batches", { cache: "no-store" }),
      fetch("/api/exceptions?page=1&pageSize=5&sortBy=risk&sortDirection=desc", { cache: "no-store" }),
    ]).then(async ([batchesResponse, exceptionsResponse]) => {
      if (!batchesResponse.ok || !exceptionsResponse.ok) throw new Error("Dashboard data could not be loaded.");
      const batches = await batchesResponse.json() as { items: BatchHistoryItem[] };
      const exceptions = await exceptionsResponse.json() as ExceptionPage;
      if (active) setData({ batch: batches.items[0], exceptions });
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Dashboard data could not be loaded."); });
    return () => { active = false; };
  }, []);

  if (error) return <p role="alert" className="p-12 text-center text-red-500">{error}</p>;
  if (!data) return <p className="p-12 text-center text-text-secondary">Loading dashboard...</p>;
  if (!data.batch) return <div className="card p-12 text-center"><h2 className="text-2xl font-bold">No analyzed batch yet</h2><p className="mt-3 text-text-secondary">Upload a Finance batch to begin shared review.</p><Link href="/upload" className="btn-primary inline-flex mt-6">Upload Invoice Batch</Link></div>;
  const { batch, exceptions } = data;
  const summary = batch.summary;

  const total = summary.totalProcessed;
  const clearedPct = total > 0 ? (summary.autoPassed / total) * 100 : 0;
  const reviewPct = total > 0 ? (summary.needsReview / total) * 100 : 0;
  const highRiskPct = total > 0 ? (summary.highRisk / total) * 100 : 0;

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-text-secondary">Latest shared Finance batch.</p>
        </div>
        <div className="text-[11px] font-medium text-text-muted md:text-right uppercase tracking-widest space-y-1">
          <p>Batch {batch.id}</p>
          <p>Processed {batch.processedAt ? new Date(batch.processedAt).toLocaleString() : "Pending"}</p>
          <p>Policy {batch.policyVersionId} · {batch.fileCount} file(s)</p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard title="Total Transactions" value={summary.totalProcessed} />
        <MetricCard title="Auto-cleared" value={summary.autoPassed} />
        <MetricCard title="Needs Review" value={summary.needsReview} />
        <MetricCard title="High Risk" value={summary.highRisk} />
        <MetricCard title="Duplicate Candidates" value={summary.duplicateCandidates} />
        <MetricCard title="Financial Exposure" value={summary.potentialExposure} isCurrency />
      </div>

      {/* Transaction Review Flow */}
      <div className="card card-hoverable p-8">
        <div className="mb-6">
          <p className="font-bold text-lg">Transaction Review Flow</p>
          <p className="text-sm text-text-secondary mt-1">Distribution of {total.toLocaleString()} processed transactions.</p>
        </div>
        
        <div className="relative h-4 rounded overflow-hidden flex bg-surface-secondary mb-4">
          <div className="h-full bg-green-500 transition-all duration-[800ms]" style={{ width: `${clearedPct}%` }} />
          <div className="h-full bg-amber-500 transition-all duration-[800ms] delay-100" style={{ width: `${reviewPct}%` }} />
          <div className="h-full bg-red-500 transition-all duration-[800ms] delay-200" style={{ width: `${highRiskPct}%` }} />
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm mt-6 pt-6 border-t border-border-subtle">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-sm bg-green-500"></span>
              <span className="font-bold text-text-primary">Auto-Cleared</span>
            </div>
            <p className="text-text-secondary">{summary.autoPassed.toLocaleString()} transactions ({clearedPct.toFixed(1)}%)</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-sm bg-amber-500"></span>
              <span className="font-bold text-text-primary">Needs Review</span>
            </div>
            <p className="text-text-secondary">{summary.needsReview.toLocaleString()} transactions ({reviewPct.toFixed(1)}%)</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-sm bg-red-500"></span>
              <span className="font-bold text-text-primary">High Risk</span>
            </div>
            <p className="text-text-secondary">{summary.highRisk.toLocaleString()} exceptions ({highRiskPct.toFixed(1)}%)</p>
          </div>
        </div>
      </div>

      {/* Needs Attention Queue */}
      <section>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold">Needs Attention</h2>
          <Link href="/exceptions" className="text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors">View all exceptions</Link>
        </div>
        <div className="card divide-y divide-border-subtle">
          {exceptions.items.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-text-primary font-bold">All caught up</p>
              <p className="text-sm text-text-secondary mt-1">No priority exceptions require review.</p>
            </div>
          ) : (
            exceptions.items.map(({ transaction, decision }) => (
              <Link 
                key={transaction.id} 
                href={`/exceptions/${transaction.id}`} 
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-surface-hover transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <StatusBadge status={decision.status} />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-3">
                      <p className="font-bold text-text-primary group-hover:text-button-primary transition-colors">{transaction.invoiceNumber ?? transaction.id}</p>
                      <p className="text-[13px] font-semibold text-text-primary">{transaction.vendorName ?? "Unknown vendor"}</p>
                    </div>
                    <p className="text-sm text-text-secondary mt-1">{decision.headline}</p>
                  </div>
                </div>
                <div className="mt-3 sm:mt-0 sm:text-right">
                  <p className="font-bold text-text-primary tracking-tight">
                    {transaction.amount ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: transaction.currency ?? 'INR', maximumFractionDigits: 0 }).format(transaction.amount) : "Missing Amount"}
                  </p>
                  <p className="text-xs text-text-muted mt-1 uppercase tracking-wider">
                    {transaction.invoiceDate ? new Date(transaction.invoiceDate).toLocaleDateString() : "No Date"}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

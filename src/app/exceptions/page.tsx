"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import {
  DEFAULT_EXCEPTION_PAGE_SIZE,
  getCurrentBatchMetadata,
  getExceptionsPage,
  getActiveFinancePolicy,
  type BatchMetadata,
  type ExceptionsPageResult,
} from "@/lib/storage";
import { ServerExceptionQueue } from "@/components/ServerExceptionQueue";
import { PolicyRequiredState } from "@/components/PolicyRequiredState";
import type { FinancePolicy } from "@/types/policies";
import { formatCurrency } from "@/lib/formatting";

type FilterType = "All" | "HIGH_RISK" | "REVIEW";

export default function ExceptionsPage() {
  return process.env.NEXT_PUBLIC_APP_MODE === "SERVER"
    ? <ServerExceptionQueue />
    : <LocalExceptionsPage />;
}

function LocalExceptionsPage() {
  const [metadata, setMetadata] = useState<BatchMetadata | null>();
  const [result, setResult] = useState<ExceptionsPageResult>();
  const [filter, setFilter] = useState<FilterType>("All");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [activePolicy, setActivePolicy] = useState<FinancePolicy>();
  const [policyLoaded, setPolicyLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [current, policy] = await Promise.all([
          getCurrentBatchMetadata(),
          getActiveFinancePolicy(),
        ]);
        if (!active) return;
        setActivePolicy(policy);
        setPolicyLoaded(true);
        setMetadata(current ?? null);
        if (!current) return;
        const loaded = await getExceptionsPage({
          batchId: current.batchId,
          status: filter === "All" ? undefined : filter,
          page,
          pageSize: DEFAULT_EXCEPTION_PAGE_SIZE,
        });
        if (active) setResult(loaded);
      } catch {
        if (active) setLoadError("Exceptions could not be loaded from browser storage.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [filter, page]);

  if (loadError) {
    return <div className="p-12 text-center text-sm text-red-500">{loadError}</div>;
  }

  if (!policyLoaded || metadata === undefined || (loading && !result)) {
    return (
      <div className="flex justify-center p-12">
        <div className="text-text-secondary animate-pulse font-bold tracking-widest uppercase text-xs">Loading exceptions...</div>
      </div>
    );
  }

  if (!metadata) {
    if (!activePolicy) return <div className="mt-10"><PolicyRequiredState /></div>;
    return (
      <div className="max-w-3xl mx-auto mt-10 text-center">
        <h2 className="text-xl font-bold text-text-primary mb-4">No analyzed batch yet.</h2>
        <Link href="/upload" className="btn-primary inline-flex">Upload a batch to get started</Link>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex justify-center p-12">
        <div className="text-text-secondary animate-pulse font-bold tracking-widest uppercase text-xs">Loading exceptions...</div>
      </div>
    );
  }

  const totalExceptions = metadata.batchSummary
    ? metadata.batchSummary.highRisk + metadata.batchSummary.needsReview
    : filter === "All" ? result.totalItems : undefined;

  if (totalExceptions === 0) {
    return (
      <div className="max-w-3xl mx-auto mt-12 relative z-10">
        <div className="card p-12 text-center flex flex-col items-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 border border-green-200 mb-6 shadow-sm">
            <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">No exceptions require review</h2>
          <p className="text-sm font-medium text-text-secondary">All transactions were auto-cleared.</p>
        </div>
      </div>
    );
  }

  const selectFilter = (nextFilter: FilterType) => {
    if (nextFilter === filter && page === 1) return;
    setLoading(true);
    setLoadError(undefined);
    setFilter(nextFilter);
    setPage(1);
  };

  const selectPage = (nextPage: number) => {
    if (nextPage === page) return;
    setLoading(true);
    setLoadError(undefined);
    setPage(nextPage);
  };

  return (
    <div className="space-y-8 relative z-10 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-border-default pb-5 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">
            Exception Queue
          </h1>
          <p className="mt-2 text-base font-medium text-text-secondary">
            Review flagged transactions before approval.
          </p>
        </div>
        <div className="flex bg-slate-100/50 p-1 rounded-xl border border-border-default shadow-sm">
          <button
            onClick={() => selectFilter("All")}
            className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-[180ms] ease-[cubic-bezier(.22,1,.36,1)] ${
              filter === "All"
                ? "bg-white text-neutral-900 shadow-sm ring-1 ring-black/5"
                : "text-text-muted hover:text-text-primary hover:bg-black/5"
            }`}
          >
            All
          </button>
          <button
            onClick={() => selectFilter("HIGH_RISK")}
            className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-[180ms] ease-[cubic-bezier(.22,1,.36,1)] ${
              filter === "HIGH_RISK"
                ? "bg-red-50 text-red-500 shadow-sm ring-1 ring-status-danger-border/50"
                : "text-text-muted hover:text-text-primary hover:bg-black/5"
            }`}
          >
            High Risk
          </button>
          <button
            onClick={() => selectFilter("REVIEW")}
            className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-[180ms] ease-[cubic-bezier(.22,1,.36,1)] ${
              filter === "REVIEW"
                ? "bg-amber-50 text-amber-500 shadow-sm ring-1 ring-status-warning-border/50"
                : "text-text-muted hover:text-text-primary hover:bg-black/5"
            }`}
          >
            Review
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full">
            <thead>
              <tr>
                <th scope="col" className="table-header">Risk</th>
                <th scope="col" className="table-header">Invoice</th>
                <th scope="col" className="table-header">Vendor</th>
                <th scope="col" className="table-header text-right">Amount</th>
                <th scope="col" className="table-header">Primary Issue</th>
                <th scope="col" className="table-header relative"><span className="sr-only">Review</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border/30">
              {!loading && result.items.map(({ transaction: t, decision }) => {
                return (
                  <tr key={t.id} className="hover:bg-surface-hover transition-colors group">
                    <td className="table-cell">
                      <StatusBadge status={decision.status} />
                    </td>
                    <td className="table-cell font-bold text-text-primary max-w-[120px] truncate" title={t.invoiceNumber || undefined}>
                      {t.invoiceNumber || "-"}
                    </td>
                    <td className="table-cell font-semibold text-text-secondary max-w-[150px] truncate" title={t.vendorName || undefined}>
                      {t.vendorName || "-"}
                    </td>
                    <td className="table-cell font-heading font-semibold text-text-primary text-right text-base">
                      {typeof t.amount === "number" && Number.isFinite(t.amount)
                        ? formatCurrency(t.amount, t.currency ?? "INR")
                        : "-"}
                    </td>
                    <td className="table-cell text-text-muted max-w-xs truncate font-medium">
                      {decision.headline || "Requires review"}
                    </td>
                    <td className="table-cell text-right">
                      <Link
                        href={`/exceptions/${t.id}`}
                        className="inline-flex items-center gap-2 text-neutral-900 font-bold hover:text-white hover:border-neutral-900 bg-neutral-900/5 hover:bg-neutral-900 px-4 py-2 rounded-lg transition-all duration-[180ms] border border-neutral-900/20 hover:shadow-md"
                      >
                        Review
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="sr-only">, {t.id}</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-xs font-bold uppercase tracking-widest text-text-secondary animate-pulse">
                    Loading exceptions...
                  </td>
                </tr>
              )}
              {!loading && result.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-medium text-text-muted">
                    No exceptions found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border-default px-6 py-4 bg-slate-50/50">
          <button
            type="button"
            onClick={() => selectPage(Math.max(1, result.page - 1))}
            disabled={loading || result.page <= 1}
            className="btn-secondary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm font-bold text-text-secondary">
            {loading ? "..." : `Page ${result.page} of ${Math.max(1, result.totalPages)}`}
          </span>
          <button
            type="button"
            onClick={() => selectPage(result.page + 1)}
            disabled={loading || result.totalPages === 0 || result.page >= result.totalPages}
            className="btn-secondary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

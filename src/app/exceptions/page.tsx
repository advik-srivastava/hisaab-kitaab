"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import {
  DEFAULT_EXCEPTION_PAGE_SIZE,
  getCurrentBatchMetadata,
  getExceptionsPage,
  type BatchMetadata,
  type ExceptionsPageResult,
} from "@/lib/storage";

type FilterType = "All" | "HIGH_RISK" | "REVIEW";

export default function ExceptionsPage() {
  const [metadata, setMetadata] = useState<BatchMetadata | null>();
  const [result, setResult] = useState<ExceptionsPageResult>();
  const [filter, setFilter] = useState<FilterType>("All");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const current = await getCurrentBatchMetadata();
        if (!active) return;
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
    return <div className="p-12 text-center text-sm text-status-danger-text">{loadError}</div>;
  }

  if (metadata === undefined || (loading && !result)) {
    return (
      <div className="flex justify-center p-12">
        <div className="text-text-secondary animate-pulse font-bold tracking-widest uppercase text-xs">Loading exceptions...</div>
      </div>
    );
  }

  if (!metadata) {
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
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-status-success-bg border border-status-success-border mb-6 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <svg className="h-8 w-8 text-status-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-panel-border pb-5 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">
            Exception Queue
          </h1>
          <p className="mt-2 text-base font-medium text-text-secondary">
            Review flagged transactions before approval.
          </p>
        </div>
        <div className="flex bg-panel p-1 rounded-xl border border-panel-border shadow-inner">
          <button
            onClick={() => selectFilter("All")}
            className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-[180ms] ease-[cubic-bezier(.22,1,.36,1)] ${
              filter === "All"
                ? "bg-brand-primary/20 text-brand-primary shadow-[inset_0_0_10px_rgba(59,130,246,0.2)]"
                : "text-text-muted hover:text-text-primary hover:bg-panel-hover"
            }`}
          >
            All
          </button>
          <button
            onClick={() => selectFilter("HIGH_RISK")}
            className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-[180ms] ease-[cubic-bezier(.22,1,.36,1)] ${
              filter === "HIGH_RISK"
                ? "bg-status-danger-bg text-status-danger-text shadow-[inset_0_0_10px_rgba(239,68,68,0.15)]"
                : "text-text-muted hover:text-text-primary hover:bg-panel-hover"
            }`}
          >
            High Risk
          </button>
          <button
            onClick={() => selectFilter("REVIEW")}
            className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-[180ms] ease-[cubic-bezier(.22,1,.36,1)] ${
              filter === "REVIEW"
                ? "bg-status-warning-bg text-status-warning-text shadow-[inset_0_0_10px_rgba(245,158,11,0.15)]"
                : "text-text-muted hover:text-text-primary hover:bg-panel-hover"
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
                  <tr key={t.id} className="hover:bg-panel-hover transition-colors group">
                    <td className="table-cell">
                      <StatusBadge status={decision.status} />
                    </td>
                    <td className="table-cell font-bold text-text-primary max-w-[120px] truncate" title={t.invoiceNumber || undefined}>
                      {t.invoiceNumber || "-"}
                    </td>
                    <td className="table-cell font-semibold text-text-secondary max-w-[150px] truncate" title={t.vendorName || undefined}>
                      {t.vendorName || "-"}
                    </td>
                    <td className="table-cell font-bold text-text-primary text-right">
                      {typeof t.amount === "number" && Number.isFinite(t.amount)
                        ? <span className="bg-panel px-3 py-1.5 rounded-lg border border-panel-border shadow-inner">{`₹${t.amount.toLocaleString()}`}</span>
                        : "-"}
                    </td>
                    <td className="table-cell text-text-muted max-w-xs truncate font-medium">
                      {decision.headline || "Requires review"}
                    </td>
                    <td className="table-cell text-right">
                      <Link
                        href={`/exceptions/${t.id}`}
                        className="inline-flex items-center gap-2 text-brand-primary font-bold hover:text-white hover:border-brand-primary bg-brand-primary/10 hover:bg-brand-primary px-4 py-2 rounded-lg transition-all duration-300 border border-brand-primary/20 hover:shadow-[0_0_15px_var(--color-brand-glow)]"
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
        <div className="flex items-center justify-between border-t border-panel-border px-6 py-4 bg-black/20">
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

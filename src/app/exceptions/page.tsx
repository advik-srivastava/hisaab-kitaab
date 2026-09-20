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
    return <div className="p-12 text-center text-sm text-red-600">{loadError}</div>;
  }

  if (metadata === undefined || (loading && !result)) {
    return (
      <div className="flex justify-center p-12">
        <div className="text-slate-500">Loading exceptions...</div>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="max-w-3xl mx-auto mt-10 text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">No analyzed batch yet.</h2>
        <Link href="/upload" className="text-blue-600 hover:underline">Upload a batch to get started.</Link>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex justify-center p-12">
        <div className="text-slate-500">Loading exceptions...</div>
      </div>
    );
  }

  const totalExceptions = metadata.batchSummary
    ? metadata.batchSummary.highRisk + metadata.batchSummary.needsReview
    : filter === "All" ? result.totalItems : undefined;

  if (totalExceptions === 0) {
    return (
      <div className="max-w-3xl mx-auto mt-12">
        <div className="bg-white border border-slate-200/75 rounded-xl p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-inset ring-emerald-600/20 mb-5">
            <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">No exceptions require review</h2>
          <p className="text-sm text-slate-500">All transactions were auto-cleared.</p>
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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-slate-200 pb-5 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Exception Queue
          </h1>
          <p className="mt-2 text-base text-slate-600">
            Review flagged transactions before approval.
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => selectFilter("All")}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 ${
              filter === "All"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => selectFilter("HIGH_RISK")}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 ${
              filter === "HIGH_RISK"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            High Risk
          </button>
          <button
            onClick={() => selectFilter("REVIEW")}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 ${
              filter === "REVIEW"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            Review
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200/75 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                >
                  Risk
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                >
                  Invoice
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                >
                  Vendor
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider"
                >
                  Amount
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                >
                  Primary Issue
                </th>
                <th scope="col" className="relative px-6 py-4">
                  <span className="sr-only">Review</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {!loading && result.items.map(({ transaction: t, decision }) => {
                return (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <StatusBadge status={decision.status} />
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm font-semibold text-slate-900">
                      {t.invoiceNumber || "-"}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-slate-600">
                      {t.vendorName || "-"}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-900 font-semibold text-right">
                      {typeof t.amount === "number" && Number.isFinite(t.amount)
                        ? <span className="bg-slate-50 px-3 py-1.5 rounded-md border border-slate-100">{`₹${t.amount.toLocaleString()}`}</span>
                        : "-"}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-600 max-w-xs truncate">
                      {decision.headline || "Requires review"}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-semibold">
                      <Link
                        href={`/exceptions/${t.id}`}
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 bg-white hover:bg-blue-50 px-4 py-2 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors"
                      >
                        Review
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                    Loading exceptions...
                  </td>
                </tr>
              )}
              {!loading && result.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                    No exceptions found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={() => selectPage(Math.max(1, result.page - 1))}
            disabled={loading || result.page <= 1}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm font-medium text-slate-600">
            {loading ? "Loading..." : `Page ${result.page} of ${Math.max(1, result.totalPages)}`}
          </span>
          <button
            type="button"
            onClick={() => selectPage(result.page + 1)}
            disabled={loading || result.totalPages === 0 || result.page >= result.totalPages}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

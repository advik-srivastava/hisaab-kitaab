"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { loadState, type PersistedState } from "@/lib/storage";
import { DecisionStatus } from "@/types/decisions";

type FilterType = "All" | "HIGH_RISK" | "REVIEW";

export default function ExceptionsPage() {
  const [state, setState] = useState<PersistedState | null>(null);
  const [filter, setFilter] = useState<FilterType>("All");

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
      <div className="max-w-3xl mx-auto mt-10 text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">No analyzed batch yet.</h2>
        <Link href="/upload" className="text-blue-600 hover:underline">Upload a batch to get started.</Link>
      </div>
    );
  }

  const { transactions, decisions } = batch;
  
  const allExceptions = transactions.filter((t) => {
    const status = decisions[t.id]?.status;
    return status === "HIGH_RISK" || status === "REVIEW";
  });

  if (allExceptions.length === 0) {
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

  const filteredExceptions = allExceptions.filter((t) => {
    if (filter === "All") return true;
    return decisions[t.id]?.status === filter;
  });

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
            onClick={() => setFilter("All")}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 ${
              filter === "All"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("HIGH_RISK")}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 ${
              filter === "HIGH_RISK"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            High Risk
          </button>
          <button
            onClick={() => setFilter("REVIEW")}
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
              {filteredExceptions.map((t) => {
                const decision = decisions[t.id];
                return (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <StatusBadge status={decision.status as DecisionStatus} />
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
              {filteredExceptions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                    No records match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

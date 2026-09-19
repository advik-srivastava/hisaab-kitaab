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
      <div className="max-w-3xl mx-auto mt-10">
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">No exceptions require review.</h2>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Exception Queue
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review flagged transactions before approval.
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter("All")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md border ${
              filter === "All"
                ? "bg-slate-900 text-white border-transparent"
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("HIGH_RISK")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md border ${
              filter === "HIGH_RISK"
                ? "bg-slate-900 text-white border-transparent"
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            High Risk
          </button>
          <button
            onClick={() => setFilter("REVIEW")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md border ${
              filter === "REVIEW"
                ? "bg-slate-900 text-white border-transparent"
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Review
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Risk
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Invoice
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Vendor
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Amount
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Primary Issue
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">View</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredExceptions.map((t) => {
                const decision = decisions[t.id];
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={decision.status as DecisionStatus} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {t.invoiceNumber || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {t.vendorName || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                      {typeof t.amount === "number" && Number.isFinite(t.amount)
                        ? `₹${t.amount.toLocaleString()}`
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {decision.headline || "Requires review"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/exceptions/${t.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View<span className="sr-only">, {t.id}</span>
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

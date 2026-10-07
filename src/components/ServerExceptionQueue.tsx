"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import type { ExceptionPage, ExceptionQuery, ReviewAction, SavedFilterRecord, UserRecord } from "@/server/platform/types";
import { formatCurrency } from "@/lib/formatting";

type QueryState = Required<Pick<ExceptionQuery, "page" | "pageSize" | "status" | "sortBy" | "sortDirection">> & ExceptionQuery;

const initialQuery: QueryState = { page: 1, pageSize: 50, status: "ALL", sortBy: "risk", sortDirection: "desc" };

function queryString(query: QueryState): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined && value !== "" && value !== false) params.set(name, String(value));
  }
  return params.toString();
}

export function ServerExceptionQueue() {
  const [query, setQuery] = useState<QueryState>(initialQuery);
  const [searchInput, setSearchInput] = useState("");
  const [result, setResult] = useState<ExceptionPage>();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilterRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      setSelected(new Set());
      setQuery((current) => ({ ...current, search: searchInput || undefined, page: 1 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    const encoded = queryString(query);
    window.history.replaceState(null, "", `/exceptions?${encoded}`);
    void fetch(`/api/exceptions?${encoded}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Exceptions could not be loaded.");
        return response.json() as Promise<ExceptionPage>;
      })
      .then((loaded) => { if (active) setResult(loaded); })
      .catch((caught) => { if (active) setMessage(caught instanceof Error ? caught.message : "Exceptions could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/users", { cache: "no-store" }).then((response) => response.ok ? response.json() : { items: [] }) as Promise<{ items: UserRecord[] }>,
      fetch("/api/saved-filters", { cache: "no-store" }).then((response) => response.ok ? response.json() : { items: [] }) as Promise<{ items: SavedFilterRecord[] }>,
    ]).then(([userBody, filterBody]) => { setUsers(userBody.items); setSavedFilters(filterBody.items); });
  }, []);

  const selectedItems = useMemo(() => result?.items.filter(({ transaction }) => selected.has(transaction.id)) ?? [], [result, selected]);
  const updateQuery = (updates: Partial<QueryState>) => {
    setLoading(true);
    setSelected(new Set());
    setQuery((current) => ({ ...current, ...updates, page: updates.page ?? 1 }));
  };
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const bulkReview = async (action: ReviewAction) => {
    if (selectedItems.length === 0 || !window.confirm(`${action.replaceAll("_", " ")} ${selectedItems.length} selected exception(s)?`)) return;
    const note = window.prompt("Audit note (optional)") ?? undefined;
    const response = await fetch("/api/exceptions", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "REVIEW", action, note, items: selectedItems.map(({ transaction, version }) => ({ transactionId: transaction.id, expectedVersion: version })) }),
    });
    const body = await response.json() as { succeeded?: string[]; failed?: unknown[]; error?: { message?: string } };
    setMessage(response.ok ? `${body.succeeded?.length ?? 0} updated; ${body.failed?.length ?? 0} failed.` : body.error?.message ?? "Bulk review failed.");
    if (response.ok) updateQuery({ page: query.page });
  };

  const bulkAssign = async (reviewerId: string) => {
    if (!reviewerId || selectedItems.length === 0 || !window.confirm(`Assign ${selectedItems.length} exception(s)?`)) return;
    const response = await fetch("/api/exceptions", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "ASSIGN", reviewerId, items: selectedItems.map(({ transaction, version }) => ({ transactionId: transaction.id, expectedVersion: version })) }),
    });
    const body = await response.json() as { succeeded?: string[]; failed?: unknown[]; error?: { message?: string } };
    setMessage(response.ok ? `${body.succeeded?.length ?? 0} assigned; ${body.failed?.length ?? 0} failed.` : body.error?.message ?? "Assignment failed.");
    if (response.ok) updateQuery({ page: query.page });
  };

  const saveView = async () => {
    const name = window.prompt("Saved view name");
    if (!name) return;
    const response = await fetch("/api/saved-filters", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, query }) });
    setMessage(response.ok ? "View saved." : "View could not be saved.");
    if (response.ok) {
      const body = await fetch("/api/saved-filters", { cache: "no-store" }).then((loaded) => loaded.json()) as { items: SavedFilterRecord[] };
      setSavedFilters(body.items);
    }
  };

  const toggleAll = () => {
    if (selected.size === result?.items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(result?.items.map(item => item.transaction.id)));
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Exception Queue</h1>
          <p className="mt-2 text-text-secondary">Search, assign, and review shared Finance exceptions.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary font-bold text-xs uppercase tracking-wider" onClick={() => void saveView()}>Save View</button>
          <a className="btn-secondary font-bold text-xs uppercase tracking-wider" href={`/api/exports/exceptions?format=csv&${queryString(query)}`}>CSV Export</a>
          <a className="btn-secondary font-bold text-xs uppercase tracking-wider" href={`/api/exports/exceptions?format=xlsx&${queryString(query)}`}>XLSX Export</a>
        </div>
      </div>

      {/* Filter Section */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between mb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Active Filters</p>
          <button className="text-xs font-bold text-neutral-900 hover:opacity-70 transition-opacity" onClick={() => setQuery(initialQuery)}>Clear All</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <input 
              aria-label="Search exceptions" 
              className="w-full rounded-lg bg-surface-primary border border-border-default px-4 py-2.5 text-sm font-medium focus-visible:ring-1 focus-visible:ring-neutral-900" 
              placeholder="Search by invoice, vendor, or employee..." 
              value={searchInput} 
              onChange={(event) => setSearchInput(event.target.value)} 
            />
          </div>
          <select 
            aria-label="Risk filter" 
            className="rounded-lg bg-surface-elevated border border-border-default px-4 py-2.5 text-sm font-bold text-neutral-900" 
            value={query.status} 
            onChange={(event) => updateQuery({ status: event.target.value as QueryState["status"] })}
          >
            <option value="ALL">All Risk Levels</option>
            <option value="HIGH_RISK">High Risk Only</option>
            <option value="REVIEW">Needs Review</option>
          </select>
          <select 
            aria-label="Sort exceptions" 
            className="rounded-lg bg-surface-elevated border border-border-default px-4 py-2.5 text-sm font-bold text-neutral-900" 
            value={query.sortBy} 
            onChange={(event) => updateQuery({ sortBy: event.target.value as QueryState["sortBy"] })}
          >
            <option value="risk">Sort by Risk</option>
            <option value="amount">Sort by Amount</option>
            <option value="invoiceDate">Sort by Date</option>
            <option value="vendor">Sort by Vendor</option>
            <option value="duplicateSimilarity">Sort by Duplicates</option>
          </select>
        </div>

        <details className="mt-4 group">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest text-text-secondary hover:text-neutral-900 list-none inline-flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-surface-elevated border border-border-subtle flex items-center justify-center text-[10px] group-open:bg-neutral-900 group-open:text-white group-open:border-neutral-900 transition-colors">+</span>
            Advanced Filters
          </summary>
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-border-subtle">
            <select aria-label="Review status" className="rounded-md bg-surface-primary border border-border-default px-3 py-1.5 text-xs font-semibold" value={query.reviewStatus ?? ""} onChange={(event) => updateQuery({ reviewStatus: event.target.value as ExceptionQuery["reviewStatus"] || undefined })}><option value="">Any review state</option><option value="UNREVIEWED">Unreviewed</option><option value="REVIEWED">Reviewed</option></select>
            <select aria-label="Duplicate type" className="rounded-md bg-surface-primary border border-border-default px-3 py-1.5 text-xs font-semibold" value={query.duplicateType ?? ""} onChange={(event) => updateQuery({ duplicateType: event.target.value as ExceptionQuery["duplicateType"] || undefined })}><option value="">Any duplicate type</option><option value="EXACT">Exact</option><option value="PROBABLE">Probable</option><option value="FUZZY">Fuzzy</option></select>
            <select aria-label="Assigned reviewer" className="rounded-md bg-surface-primary border border-border-default px-3 py-1.5 text-xs font-semibold" value={query.unassigned ? "unassigned" : query.assignedReviewerId ?? ""} onChange={(event) => updateQuery(event.target.value === "unassigned" ? { unassigned: true, assignedReviewerId: undefined } : { unassigned: undefined, assignedReviewerId: event.target.value || undefined })}><option value="">Any assignment</option><option value="unassigned">Unassigned</option>{users.filter(({ role }) => role !== "AUDITOR").map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}</select>
            <input aria-label="Department" placeholder="Department" className="rounded-md bg-surface-primary border border-border-default px-3 py-1.5 text-xs font-semibold" value={query.department ?? ""} onChange={(event) => updateQuery({ department: event.target.value || undefined })} />
            <input aria-label="Expense category" placeholder="Expense category" className="rounded-md bg-surface-primary border border-border-default px-3 py-1.5 text-xs font-semibold" value={query.expenseCategory ?? ""} onChange={(event) => updateQuery({ expenseCategory: event.target.value || undefined })} />
            <select aria-label="Exception age" className="rounded-md bg-surface-primary border border-border-default px-3 py-1.5 text-xs font-semibold" value={query.ageBucket ?? ""} onChange={(event) => updateQuery({ ageBucket: event.target.value as ExceptionQuery["ageBucket"] || undefined })}><option value="">Any age</option><option value="LT_1_DAY">Under 1 day</option><option value="ONE_TO_THREE_DAYS">1–3 days</option><option value="FOUR_TO_SEVEN_DAYS">4–7 days</option><option value="SEVEN_PLUS_DAYS">7+ days</option></select>
            <select aria-label="Saved view" className="rounded-md bg-surface-primary border border-border-default px-3 py-1.5 text-xs font-semibold" defaultValue="" onChange={(event) => { const saved = savedFilters.find(({ id }) => id === event.target.value); if (saved) setQuery({ ...initialQuery, ...saved.query, page: 1 }); }}><option value="">Saved views...</option>{savedFilters.map((filter) => <option key={filter.id} value={filter.id}>{filter.name}</option>)}</select>
          </div>
        </details>
      </div>

      {selected.size > 0 && (
        <div className="card p-3 flex flex-wrap items-center gap-3 bg-neutral-900 border-neutral-900 shadow-md sticky top-4 z-40 animate-in slide-in-from-top-4 duration-200">
          <span className="font-bold text-white ml-2">{selected.size} items selected</span>
          <div className="ml-auto flex gap-2">
            <button className="btn-secondary bg-white/10 hover:bg-white/20 text-white border-white/10 text-xs font-bold uppercase tracking-wider" onClick={() => void bulkReview("APPROVE")}>Approve</button>
            <button className="btn-secondary bg-white/10 hover:bg-white/20 text-white border-white/10 text-xs font-bold uppercase tracking-wider" onClick={() => void bulkReview("REJECT")}>Reject</button>
            <button className="btn-secondary bg-white/10 hover:bg-white/20 text-white border-white/10 text-xs font-bold uppercase tracking-wider" onClick={() => void bulkReview("MARK_NOT_DUPLICATE")}>Not Duplicate</button>
            <select aria-label="Assign selected" defaultValue="" onChange={(event) => void bulkAssign(event.target.value)} className="rounded-md bg-white/10 border border-white/10 text-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider outline-none">
              <option value="" className="text-black">Assign...</option>
              {users.filter(({ role }) => role !== "AUDITOR").map((user) => <option key={user.id} value={user.id} className="text-black">{user.displayName}</option>)}
            </select>
          </div>
        </div>
      )}

      {message && <p aria-live="polite" className="text-sm font-semibold text-green-600 bg-green-50 px-4 py-3 rounded-xl border border-green-200">{message}</p>}
      
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-secondary border-b border-border-default">
                <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-widest text-text-muted w-10">
                  <input type="checkbox" className="rounded border-border-default text-neutral-900 focus:ring-neutral-900 cursor-pointer" aria-label="Select all" checked={selected.size === result?.items.length && selected.size > 0} onChange={toggleAll} />
                </th>
                {["Risk", "Invoice", "Vendor", "Amount", "Issue", "Reviewer", "Action"].map((title) => (
                  <th key={title} className="py-3 px-4 font-bold text-[11px] uppercase tracking-widest text-text-muted">{title}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-surface-primary">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-6 h-6 border-2 border-border-default border-t-neutral-900 rounded-full animate-spin mb-3"></div>
                      <p className="text-sm font-bold text-text-secondary uppercase tracking-widest">Loading records...</p>
                    </div>
                  </td>
                </tr>
              ) : result?.items.map((item) => (
                <tr key={item.transaction.id} className={`hover:bg-surface-hover transition-colors group ${selected.has(item.transaction.id) ? 'bg-neutral-900/[0.02]' : ''}`}>
                  <td className="py-3 px-4">
                    <input type="checkbox" className="rounded border-border-default text-neutral-900 focus:ring-neutral-900 cursor-pointer" aria-label={`Select ${item.transaction.id}`} checked={selected.has(item.transaction.id)} onChange={() => toggle(item.transaction.id)} />
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={item.decision.status} />
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-bold text-[13px] group-hover:text-neutral-900 transition-colors">{item.transaction.invoiceNumber ?? "-"}</p>
                    <p className="text-[11px] text-text-muted uppercase tracking-wider">{item.transaction.department ?? "No Dept"}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-sm">{item.transaction.vendorName ?? "-"}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-bold text-[13px]">{typeof item.transaction.amount === "number" ? formatCurrency(item.transaction.amount, item.transaction.currency ?? "INR") : "-"}</p>
                  </td>
                  <td className="py-3 px-4 max-w-[200px]">
                    <p className="text-sm font-medium truncate" title={item.decision.headline}>{item.decision.headline}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-1 rounded bg-surface-elevated border border-border-subtle text-[11px] font-bold text-text-secondary">
                      {item.assignment?.reviewerId ?? "Unassigned"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Link className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-neutral-900 hover:opacity-70 transition-opacity" href={`/exceptions/${item.transaction.id}`}>
                      Review
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && result?.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-16 text-center text-text-secondary">
                    <p className="font-bold text-neutral-900 mb-1">Queue is empty</p>
                    <p className="text-sm">No exceptions match your active filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 flex items-center justify-between border-t border-border-default bg-surface-secondary/50">
          <button className="btn-secondary text-xs px-3 py-1.5 uppercase tracking-widest font-bold disabled:opacity-50" disabled={!result || result.page <= 1} onClick={() => updateQuery({ page: Math.max(1, query.page - 1) })}>Previous</button>
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Page {result?.page ?? 1} of {Math.max(1, result?.totalPages ?? 1)} <span className="mx-2 opacity-30">|</span> {result?.totalItems ?? 0} items total</span>
          <button className="btn-secondary text-xs px-3 py-1.5 uppercase tracking-widest font-bold disabled:opacity-50" disabled={!result || result.page >= result.totalPages} onClick={() => updateQuery({ page: query.page + 1 })}>Next</button>
        </div>
      </div>
    </div>
  );
}

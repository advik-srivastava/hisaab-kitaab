"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import type { ExceptionPage, ExceptionQuery, ReviewAction, SavedFilterRecord, UserRecord } from "@/server/platform/types";

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

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4"><div><h1 className="text-3xl font-extrabold">Exception Queue</h1><p className="mt-2 text-text-secondary">Search, assign, and review shared Finance exceptions.</p></div><div className="flex gap-2"><button className="btn-secondary" onClick={() => void saveView()}>Save View</button><a className="btn-secondary" href={`/api/exports/exceptions?format=csv&${queryString(query)}`}>CSV</a><a className="btn-secondary" href={`/api/exports/exceptions?format=xlsx&${queryString(query)}`}>XLSX</a></div></div>
      <div className="card p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <input aria-label="Search exceptions" className="rounded-lg bg-black/40 border border-panel-border px-3 py-2 md:col-span-2" placeholder="Invoice, vendor, employee, department" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        <select aria-label="Risk filter" className="rounded-lg bg-panel border border-panel-border px-3 py-2" value={query.status} onChange={(event) => updateQuery({ status: event.target.value as QueryState["status"] })}><option value="ALL">All</option><option value="HIGH_RISK">High Risk</option><option value="REVIEW">Review</option></select>
        <select aria-label="Sort exceptions" className="rounded-lg bg-panel border border-panel-border px-3 py-2" value={query.sortBy} onChange={(event) => updateQuery({ sortBy: event.target.value as QueryState["sortBy"] })}><option value="risk">Risk</option><option value="amount">Amount</option><option value="invoiceDate">Invoice date</option><option value="vendor">Vendor</option><option value="duplicateSimilarity">Duplicate similarity</option></select>
        <select aria-label="Review status" className="rounded-lg bg-panel border border-panel-border px-3 py-2" value={query.reviewStatus ?? ""} onChange={(event) => updateQuery({ reviewStatus: event.target.value as ExceptionQuery["reviewStatus"] || undefined })}><option value="">Any review state</option><option value="UNREVIEWED">Unreviewed</option><option value="REVIEWED">Reviewed</option></select>
        <select aria-label="Duplicate type" className="rounded-lg bg-panel border border-panel-border px-3 py-2" value={query.duplicateType ?? ""} onChange={(event) => updateQuery({ duplicateType: event.target.value as ExceptionQuery["duplicateType"] || undefined })}><option value="">Any duplicate type</option><option value="EXACT">Exact</option><option value="PROBABLE">Probable</option><option value="FUZZY">Fuzzy</option></select>
        <select aria-label="Saved view" className="rounded-lg bg-panel border border-panel-border px-3 py-2" defaultValue="" onChange={(event) => { const saved = savedFilters.find(({ id }) => id === event.target.value); if (saved) setQuery({ ...initialQuery, ...saved.query, page: 1 }); }}><option value="">Saved views...</option>{savedFilters.map((filter) => <option key={filter.id} value={filter.id}>{filter.name}</option>)}</select>
        <details className="md:col-span-3 lg:col-span-6"><summary className="cursor-pointer text-sm font-semibold text-text-secondary">Advanced filters</summary><div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
          <select aria-label="Assigned reviewer" className="rounded-lg bg-panel border border-panel-border px-3 py-2" value={query.unassigned ? "unassigned" : query.assignedReviewerId ?? ""} onChange={(event) => updateQuery(event.target.value === "unassigned" ? { unassigned: true, assignedReviewerId: undefined } : { unassigned: undefined, assignedReviewerId: event.target.value || undefined })}><option value="">Any assignment</option><option value="unassigned">Unassigned</option>{users.filter(({ role }) => role !== "AUDITOR").map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}</select>
          <input aria-label="Department" placeholder="Department" className="rounded-lg bg-black/40 border border-panel-border px-3 py-2" value={query.department ?? ""} onChange={(event) => updateQuery({ department: event.target.value || undefined })} />
          <input aria-label="Expense category" placeholder="Expense category" className="rounded-lg bg-black/40 border border-panel-border px-3 py-2" value={query.expenseCategory ?? ""} onChange={(event) => updateQuery({ expenseCategory: event.target.value || undefined })} />
          <input aria-label="Invoice date from" type="date" className="rounded-lg bg-black/40 border border-panel-border px-3 py-2" value={query.dateFrom ?? ""} onChange={(event) => updateQuery({ dateFrom: event.target.value || undefined })} />
          <input aria-label="Invoice date to" type="date" className="rounded-lg bg-black/40 border border-panel-border px-3 py-2" value={query.dateTo ?? ""} onChange={(event) => updateQuery({ dateTo: event.target.value || undefined })} />
          <select aria-label="Exception age" className="rounded-lg bg-panel border border-panel-border px-3 py-2" value={query.ageBucket ?? ""} onChange={(event) => updateQuery({ ageBucket: event.target.value as ExceptionQuery["ageBucket"] || undefined })}><option value="">Any age</option><option value="LT_1_DAY">Under 1 day</option><option value="ONE_TO_THREE_DAYS">1–3 days</option><option value="FOUR_TO_SEVEN_DAYS">4–7 days</option><option value="SEVEN_PLUS_DAYS">7+ days</option></select>
          <input aria-label="Minimum amount" type="number" min="0" placeholder="Minimum amount" className="rounded-lg bg-black/40 border border-panel-border px-3 py-2" value={query.amountMin ?? ""} onChange={(event) => updateQuery({ amountMin: event.target.value ? Number(event.target.value) : undefined })} />
          <input aria-label="Maximum amount" type="number" min="0" placeholder="Maximum amount" className="rounded-lg bg-black/40 border border-panel-border px-3 py-2" value={query.amountMax ?? ""} onChange={(event) => updateQuery({ amountMax: event.target.value ? Number(event.target.value) : undefined })} />
        </div></details>
      </div>
      {selected.size > 0 && <div className="card p-4 flex flex-wrap items-center gap-3"><span className="font-bold">{selected.size} selected</span><button className="btn-secondary" onClick={() => void bulkReview("APPROVE")}>Approve</button><button className="btn-secondary" onClick={() => void bulkReview("REJECT")}>Reject</button><button className="btn-secondary" onClick={() => void bulkReview("MARK_NOT_DUPLICATE")}>Not Duplicate</button><select aria-label="Assign selected" defaultValue="" onChange={(event) => void bulkAssign(event.target.value)} className="rounded-lg bg-panel border border-panel-border px-3 py-2"><option value="">Assign selected...</option>{users.filter(({ role }) => role !== "AUDITOR").map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}</select></div>}
      {message && <p aria-live="polite" className="text-sm text-text-secondary">{message}</p>}
      <div className="card overflow-x-auto"><table className="min-w-full"><thead><tr><th className="table-header"><span className="sr-only">Select</span></th>{["Risk", "Invoice", "Vendor", "Amount", "Issue", "Reviewer", "Review"].map((title) => <th key={title} className="table-header">{title}</th>)}</tr></thead><tbody>
        {loading ? <tr><td colSpan={8} className="p-10 text-center text-text-secondary">Loading exceptions...</td></tr> : result?.items.map((item) => <tr key={item.transaction.id}><td className="table-cell"><input type="checkbox" aria-label={`Select ${item.transaction.id}`} checked={selected.has(item.transaction.id)} onChange={() => toggle(item.transaction.id)} /></td><td className="table-cell"><StatusBadge status={item.decision.status} /></td><td className="table-cell font-bold">{item.transaction.invoiceNumber ?? "-"}</td><td className="table-cell">{item.transaction.vendorName ?? "-"}</td><td className="table-cell">{typeof item.transaction.amount === "number" ? `${item.transaction.currency ?? ""} ${item.transaction.amount.toLocaleString()}` : "-"}</td><td className="table-cell max-w-xs truncate">{item.decision.headline}</td><td className="table-cell">{item.assignment?.reviewerId ?? "Unassigned"}</td><td className="table-cell"><Link className="text-brand-primary font-bold" href={`/exceptions/${item.transaction.id}`}>Open</Link></td></tr>)}
        {!loading && result?.items.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-text-secondary">No exceptions found for this filter.</td></tr>}
      </tbody></table><div className="p-4 flex justify-between border-t border-panel-border"><button className="btn-secondary" disabled={!result || result.page <= 1} onClick={() => updateQuery({ page: Math.max(1, query.page - 1) })}>Previous</button><span>Page {result?.page ?? 1} of {Math.max(1, result?.totalPages ?? 1)} · {result?.totalItems ?? 0} items</span><button className="btn-secondary" disabled={!result || result.page >= result.totalPages} onClick={() => updateQuery({ page: query.page + 1 })}>Next</button></div></div>
    </div>
  );
}

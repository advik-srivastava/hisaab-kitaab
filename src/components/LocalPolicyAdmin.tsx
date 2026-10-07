"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ZodError } from "zod";
import { parsePolicyFile } from "@/core/policies";
import {
  activateFinancePolicy,
  getActiveFinancePolicy,
  listFinancePolicies,
  saveFinancePolicyDraft,
} from "@/lib/storage";
import type { FinancePolicy } from "@/types/policies";

const samplePolicy = {
  companyName: "Acme Pvt Ltd",
  policyName: "Travel & Expense Policy",
  version: "2026.1",
  supportedCurrencies: ["INR"],
  expenseLimits: { Meals: 2500, Taxi: 4000, Hotel: 12000 },
  purchaseOrderRequiredAbove: 30000,
};

function money(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function validationMessage(error: unknown): string {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "The policy is invalid.";
  return error instanceof Error ? error.message : "The policy could not be processed.";
}

function PolicyValues({ policy }: { policy: FinancePolicy }) {
  return (
    <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <div><dt className="text-xs uppercase tracking-widest text-text-muted">Supported currencies</dt><dd className="mt-2 font-bold">{policy.supportedCurrencies.join(", ")}</dd></div>
      <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-widest text-text-muted">Expense limits</dt><dd className="mt-2 flex flex-wrap gap-2">{Object.entries(policy.expenseLimits).map(([category, limit]) => <span key={category} className="rounded-full border border-panel-border bg-black/20 px-3 py-1 text-sm">{category} {money(limit)}</span>)}</dd></div>
      <div><dt className="text-xs uppercase tracking-widest text-text-muted">PO required above</dt><dd className="mt-2 font-bold">{money(policy.purchaseOrderRequiredAbove)}</dd></div>
    </dl>
  );
}

export function LocalPolicyAdmin() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activePolicy, setActivePolicy] = useState<FinancePolicy>();
  const [history, setHistory] = useState<FinancePolicy[]>([]);
  const [preview, setPreview] = useState<FinancePolicy>();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    const [active, policies] = await Promise.all([getActiveFinancePolicy(), listFinancePolicies()]);
    setActivePolicy(active);
    setHistory(policies);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const acceptFile = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const parsed = await parsePolicyFile(file);
      await saveFinancePolicyDraft(parsed);
      setPreview(parsed);
      await refresh();
    } catch (caught) {
      setPreview(undefined);
      setError(validationMessage(caught));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const activate = async () => {
    if (!preview || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await activateFinancePolicy(preview.id);
      setPreview(undefined);
      await refresh();
    } catch (caught) {
      setError(validationMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const sampleHref = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(samplePolicy, null, 2))}`;

  return (
    <div className="space-y-8 pb-16">
      <div><h1 className="text-3xl font-bold tracking-tight">Finance Admin</h1><p className="mt-2 text-text-secondary">Manage the company policy used by deterministic invoice analysis.</p></div>

      <section className="card p-6 md:p-8 space-y-6" aria-labelledby="active-policy-title">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-brand-primary">Active Policy</p><h2 id="active-policy-title" className="mt-2 text-2xl font-bold">{activePolicy?.policyName ?? "Loading policy..."}</h2>{activePolicy && <p className="mt-1 text-sm text-text-secondary">{activePolicy.companyName} · v{activePolicy.version}</p>}</div>{activePolicy && <div className="text-right"><span className="rounded-full border border-status-success-border bg-status-success-bg px-3 py-1 text-xs font-bold text-status-success-text">ACTIVE</span><p className="mt-2 text-xs text-text-muted">{activePolicy.activatedAt ? `Activated ${new Date(activePolicy.activatedAt).toLocaleString()}` : "Built-in fallback policy"}</p></div>}</div>
        {activePolicy && <PolicyValues policy={activePolicy} />}
      </section>

      <section className="card p-6 md:p-8 space-y-5" aria-labelledby="upload-policy-title">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-brand-primary">Upload Policy</p><h2 id="upload-policy-title" className="mt-2 text-xl font-bold">Upload company Finance policy</h2></div><a download="sample-finance-policy.json" href={sampleHref} className="text-sm font-bold text-brand-primary hover:underline">Download Sample Policy Template</a></div>
        <input ref={inputRef} type="file" accept=".json,.csv,.xlsx" className="sr-only" onChange={(event) => void acceptFile(event.target.files?.[0])} />
        <div role="button" tabIndex={0} className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${dragging ? "border-brand-primary bg-brand-primary/10" : "border-panel-border hover:border-brand-primary/50"}`} onClick={() => inputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void acceptFile(event.dataTransfer.files[0]); }}>
          <p className="font-bold text-brand-primary">{busy ? "Validating policy..." : "Select a policy file or drag and drop"}</p><p className="mt-2 text-sm text-text-muted">JSON, CSV, or XLSX</p>
        </div>
        {error && <p role="alert" className="rounded-xl border border-status-danger-border bg-status-danger-bg p-4 text-sm text-status-danger-text">{error}</p>}
        <div className="rounded-xl border border-panel-border bg-black/20 p-4 flex items-center justify-between gap-4"><div><p className="text-sm font-bold">Extract Rules with Azure AI</p><p className="mt-1 text-xs text-text-muted">Planned: document extraction into a Finance-reviewed draft policy.</p></div><span className="rounded-full border border-panel-border px-3 py-1 text-xs text-text-muted">Coming next</span></div>
      </section>

      {preview && <section className="card p-6 md:p-8 space-y-6 border-brand-primary/30" aria-labelledby="preview-title"><div><p className="text-xs font-bold uppercase tracking-widest text-brand-primary">Policy Preview</p><h2 id="preview-title" className="mt-2 text-2xl font-bold">{preview.policyName}</h2><p className="mt-1 text-sm text-text-secondary">{preview.companyName} · v{preview.version}</p></div><PolicyValues policy={preview} /><div className="flex justify-end gap-3"><button className="rounded-xl border border-panel-border px-5 py-3 font-bold hover:bg-panel-hover" onClick={() => setPreview(undefined)} disabled={busy}>Cancel</button><button className="btn-primary" onClick={() => void activate()} disabled={busy}>{busy ? "Activating..." : "Activate Policy"}</button></div></section>}

      <section className="card overflow-hidden" aria-labelledby="history-title"><div className="border-b border-panel-border p-6"><p className="text-xs font-bold uppercase tracking-widest text-brand-primary">Policy History</p><h2 id="history-title" className="mt-2 text-xl font-bold">Uploaded versions</h2></div>{history.length === 0 ? <p className="p-8 text-sm text-text-secondary">No company policy versions uploaded yet. The built-in default policy is active.</p> : <div className="divide-y divide-panel-border">{history.map((policy) => <div key={policy.id} className="grid gap-3 p-6 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="font-bold">{policy.policyName} <span className="text-text-muted">v{policy.version}</span></p><p className="mt-1 text-sm text-text-secondary">{policy.companyName}</p></div><div className="text-xs text-text-muted">Created {new Date(policy.createdAt).toLocaleString()}<br />{policy.activatedAt ? `Activated ${new Date(policy.activatedAt).toLocaleString()}` : "Not activated"}</div><span className={`rounded-full border px-3 py-1 text-center text-xs font-bold ${policy.status === "ACTIVE" ? "border-status-success-border bg-status-success-bg text-status-success-text" : "border-panel-border text-text-muted"}`}>{policy.status}</span></div>)}</div>}</section>
    </div>
  );
}

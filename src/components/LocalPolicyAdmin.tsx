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
import { formatINR } from "@/lib/formatting";

function validationMessage(error: unknown): string {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "The policy is invalid.";
  return error instanceof Error ? error.message : "The policy could not be processed.";
}

function PolicyValues({ policy }: { policy: FinancePolicy }) {
  return (
    <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 bg-surface-primary p-6 rounded-xl border border-border-subtle">
      <div>
        <dt className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-2">Supported Currencies</dt>
        <dd className="font-semibold text-[15px]">{policy.supportedCurrencies.join(", ")}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-2">Expense Limits</dt>
        <dd className="flex flex-wrap gap-2">
          {Object.entries(policy.expenseLimits).map(([category, limit]) => (
            <span key={category} className="rounded border border-border-default bg-surface-secondary px-3 py-1.5 text-xs font-semibold text-text-primary">
              {category} <span className="font-bold ml-1">{formatINR(limit)}</span>
            </span>
          ))}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-2">PO Threshold</dt>
        <dd className="font-bold text-[15px]">{formatINR(policy.purchaseOrderRequiredAbove)}</dd>
      </div>
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

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-500">
      <div>
        <h1 className="text-[32px] font-extrabold tracking-tight">Finance Policy Manager</h1>
        <p className="mt-2 text-text-secondary text-[15px]">Manage the company rules used for deterministic invoice analysis.</p>
      </div>

      <section className="card p-8 md:p-10 space-y-6" aria-labelledby="active-policy-title">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Currently Active</p>
            </div>
            <h2 id="active-policy-title" className="mt-1 text-[28px] font-bold tracking-tight">
              {activePolicy?.policyName ?? "No active company policy"}
            </h2>
            {activePolicy && <p className="mt-2 text-text-secondary font-medium">{activePolicy.companyName} <span className="mx-2 opacity-50">·</span> Version {activePolicy.version}</p>}
          </div>
          {activePolicy && (
            <div className="md:text-right">
              <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-600 uppercase tracking-widest">Active</span>
              <p className="mt-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                {activePolicy.activatedAt ? `Activated ${new Date(activePolicy.activatedAt).toLocaleDateString()}` : "Time unavailable"}
              </p>
            </div>
          )}
        </div>
        
        {activePolicy ? (
          <div className="mt-8">
            <PolicyValues policy={activePolicy} />
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <span className="text-amber-500 font-bold">!</span>
            </div>
            <p className="font-semibold text-amber-700">Upload, validate, and explicitly activate a company policy before analyzing invoices.</p>
          </div>
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-8">
        <section className="card p-8" aria-labelledby="upload-policy-title">
          <div className="mb-6">
            <h2 id="upload-policy-title" className="text-xl font-bold mb-2">Deploy New Policy</h2>
            <p className="text-sm text-text-secondary">Upload a new configuration to update system rules.</p>
          </div>
          
          <input ref={inputRef} type="file" accept=".json,.csv,.xlsx" className="sr-only" onChange={(event) => void acceptFile(event.target.files?.[0])} />
          
          <div 
            role="button" 
            tabIndex={0} 
            className={`rounded-xl border-2 border-dashed p-10 text-center transition-all ${
              dragging 
                ? "border-neutral-900 bg-neutral-900/5" 
                : "border-border-default hover:border-neutral-900/40 bg-surface-primary"
            }`} 
            onClick={() => inputRef.current?.click()} 
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }} 
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }} 
            onDragLeave={() => setDragging(false)} 
            onDrop={(event) => { event.preventDefault(); setDragging(false); void acceptFile(event.dataTransfer.files[0]); }}
          >
            <div className="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-4 border border-border-subtle">
              <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <p className="font-bold text-text-primary">{busy ? "Validating policy..." : "Select policy file or drop here"}</p>
            <p className="mt-2 text-[11px] font-bold text-text-muted uppercase tracking-widest">JSON, CSV, or XLSX</p>
          </div>
          
          {error && (
            <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 font-medium">
              <span className="font-bold mr-2">Error:</span>{error}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-border-subtle flex flex-col items-center">
            <a download href="/templates/hisaab-kitaab-company-policy-sample.json" className="text-sm font-bold text-button-primary hover:opacity-80 transition-opacity">
              Download Sample JSON Template
            </a>
          </div>
        </section>

        <section className="card p-0 overflow-hidden flex flex-col" aria-labelledby="history-title">
          <div className="p-8 pb-6 border-b border-border-default bg-surface-primary">
            <h2 id="history-title" className="text-xl font-bold">Policy History</h2>
            <p className="text-sm text-text-secondary mt-2">Previously uploaded configurations.</p>
          </div>
          
          <div className="flex-1 overflow-y-auto bg-surface-primary custom-scrollbar max-h-[350px]">
            {history.length === 0 ? (
              <p className="p-8 text-sm text-text-secondary text-center">No company policy versions uploaded yet.</p>
            ) : (
              <div className="divide-y divide-border-subtle">
                {history.map((policy) => (
                  <div key={policy.id} className="p-6 hover:bg-surface-hover transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-bold text-[15px]">{policy.policyName} <span className="ml-2 px-2 py-0.5 rounded bg-surface-elevated border border-border-default text-xs text-text-muted">v{policy.version}</span></p>
                      <span className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest ${
                        policy.status === "ACTIVE" 
                          ? "bg-green-500 text-white" 
                          : "bg-surface-secondary text-text-muted border border-border-subtle"
                      }`}>
                        {policy.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-text-secondary mb-3">{policy.companyName}</p>
                    <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider space-y-1">
                      <p>Created: {new Date(policy.createdAt).toLocaleString()}</p>
                      {policy.activatedAt && <p>Activated: {new Date(policy.activatedAt).toLocaleString()}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {preview && (
        <div className="fixed inset-0 bg-neutral-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <section className="card max-w-4xl w-full p-8 md:p-10 shadow-2xl animate-in zoom-in-95 duration-200" aria-labelledby="preview-title">
            <div className="mb-8">
              <span className="px-3 py-1 rounded bg-blue-50 border border-blue-200 text-blue-600 text-xs font-bold uppercase tracking-widest mb-4 inline-block">Draft Validation Successful</span>
              <h2 id="preview-title" className="text-3xl font-extrabold tracking-tight">{preview.policyName}</h2>
              <p className="mt-2 text-text-secondary font-medium">{preview.companyName} <span className="mx-2 opacity-50">·</span> Version {preview.version}</p>
            </div>
            
            <PolicyValues policy={preview} />
            
            <div className="flex justify-end gap-3 mt-10 pt-6 border-t border-border-subtle">
              <button className="btn-secondary" onClick={() => setPreview(undefined)} disabled={busy}>Cancel</button>
              <button className="btn-primary min-w-[160px]" onClick={() => void activate()} disabled={busy}>
                {busy ? "Activating..." : "Confirm & Activate"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

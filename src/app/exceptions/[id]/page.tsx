"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { AuditTimeline } from "@/components/AuditTimeline";
import { AuditEvent } from "@/types/audit";
import { Transaction } from "@/types/transaction";
import { Decision } from "@/types/decisions";
import { RuleResult } from "@/types/rules";
import { DuplicateMatch } from "@/types/duplicates";
import { applyReviewActionAsync } from "@/core/audit";
import {
  getTransactionAsync,
  getDecisionAsync,
  getRuleResultsAsync,
  getDuplicateMatchesAsync,
  getAuditEventsAsync,
  getCurrentBatchMetadata,
} from "@/lib/storage";
import type { PolicySnapshot } from "@/types/policies";
import { ServerExceptionDetailView } from "@/components/ServerExceptionDetail";
import {
  explainExceptionWithAzure,
  type AzureExplainResponse,
} from "@/lib/azure";
import { formatCurrency } from "@/lib/formatting";

const monetaryRuleIds = new Set([
  "REQ_AMOUNT",
  "AMOUNT_POSITIVE",
  "LIMIT_MEALS",
  "LIMIT_TAXI",
  "LIMIT_HOTEL",
  "PO_REQUIRED",
]);

function formatRuleValue(rule: RuleResult, value: unknown, currency: string): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (monetaryRuleIds.has(rule.ruleId) && typeof value === "number" && Number.isFinite(value)) {
    return formatCurrency(value, currency);
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function ExceptionDetailPage() {
  return process.env.NEXT_PUBLIC_APP_MODE === "SERVER"
    ? <ServerExceptionDetailRouter />
    : <LocalExceptionDetailPage />;
}

function ServerExceptionDetailRouter() {
  const params = useParams();
  return <ServerExceptionDetailView id={params.id as string} />;
}

function LocalExceptionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [ruleResults, setRuleResults] = useState<RuleResult[]>([]);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [matchedTransaction, setMatchedTransaction] = useState<Transaction | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [policySnapshot, setPolicySnapshot] = useState<PolicySnapshot | null>(null);

  const [note, setNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [aiExplanation, setAiExplanation] = useState<{ transactionId: string; response: AzureExplainResponse } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [t, loadedDecision, loadedRules, matches, events, metadata] = await Promise.all([
        getTransactionAsync(id),
        getDecisionAsync(id),
        getRuleResultsAsync(id),
        getDuplicateMatchesAsync(id),
        getAuditEventsAsync(id),
        getCurrentBatchMetadata(),
      ]);
      setPolicySnapshot(metadata?.policySnapshot ?? null);
      if (t) {
        setTransaction(t);
        setDecision(loadedDecision || null);
        setRuleResults(loadedRules);
        setDuplicateMatches(matches);
      // Sort chronologically (oldest first)
      events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setAuditEvents(events);

      if (matches.length > 0) {
        // Load strongest match for evidence display
        const bestMatch = matches[0];
          setMatchedTransaction(await getTransactionAsync(bestMatch.matchedTransactionId) || null);
        } else {
          setMatchedTransaction(null);
        }
      } else {
        setTransaction(null);
        setDecision(null);
        setRuleResults([]);
        setDuplicateMatches([]);
        setAuditEvents([]);
        setMatchedTransaction(null);
      }
    } catch {
      setTransaction(null);
      setDecision(null);
      setRuleResults([]);
      setDuplicateMatches([]);
      setAuditEvents([]);
      setMatchedTransaction(null);
      setPolicySnapshot(null);
      setMessage({ text: "Failed to load transaction data.", type: "error" });
    } finally {
      setHasLoaded(true);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAction = async (action: "APPROVE" | "REJECT" | "MARK_NOT_DUPLICATE") => {
    if (isProcessing) return;
    if ((action === "REJECT" || action === "MARK_NOT_DUPLICATE") && !window.confirm(`Confirm ${action.replaceAll("_", " ")}?`)) return;
    setIsProcessing(true);
    setMessage(null);

    try {
      const result = await applyReviewActionAsync({
        transactionId: id,
        action,
        reviewer: "Finance Reviewer",
        note: note.trim() || undefined,
      });

      if (result?.persistence.success) {
        setMessage({
          text: "Reviewer action recorded. The system finding and evidence remain available in the audit history.",
          type: "success",
        });
        setNote("");
        await loadData();
      } else {
        setMessage({ text: "Failed to record decision.", type: "error" });
      }
    } catch {
      setMessage({ text: "Failed to record decision.", type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAzureExplanation = async () => {
    if (!transaction || !decision || isAiLoading) return;
    setIsAiLoading(true);
    setAiError(null);
    try {
      const failedRuleEvidence = ruleResults
        .filter((rule) => rule.status === "FAIL")
        .map((rule) => `${rule.ruleName}: ${rule.explanation}`);
      const strongestDuplicate = duplicateMatches[0];
      const explanation = await explainExceptionWithAzure({
        invoiceId: transaction.id,
        vendor: transaction.vendorName ?? null,
        amount: transaction.amount ?? null,
        currency: transaction.currency ?? null,
        status: decision.status,
        failedRules: failedRuleEvidence,
        duplicateEvidence: strongestDuplicate?.evidence ?? [],
        matchedRecord: matchedTransaction ? {
          id: matchedTransaction.id,
          invoiceNumber: matchedTransaction.invoiceNumber ?? null,
          vendorName: matchedTransaction.vendorName ?? null,
          amount: matchedTransaction.amount ?? null,
          invoiceDate: matchedTransaction.invoiceDate ?? null,
        } : null,
      });
      setAiExplanation({ transactionId: transaction.id, response: explanation });
    } catch {
      setAiError("Azure AI explanation could not be generated. The existing system evidence remains available.");
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.ctrlKey || event.metaKey || event.altKey || (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)))) return;
      if (event.key.toLowerCase() === "a") void handleAction("APPROVE");
      if (event.key.toLowerCase() === "r") void handleAction("REJECT");
      if (event.key.toLowerCase() === "n" && duplicateMatches.length > 0) void handleAction("MARK_NOT_DUPLICATE");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (!hasLoaded) {
    return (
      <div className="flex justify-center p-12">
        <div className="text-text-secondary animate-pulse text-xs font-bold uppercase tracking-widest">Loading exception details...</div>
      </div>
    );
  }

  if (!transaction || !decision) {
    return (
      <div className="max-w-3xl mx-auto mt-10 text-center">
        <h2 className="text-xl font-bold text-text-primary mb-3">
          {message?.type === "error" ? message.text : "Exception not found."}
        </h2>
        <Link href="/exceptions" className="text-brand-primary hover:underline font-semibold">
          Return to the exception queue
        </Link>
      </div>
    );
  }

  const failedRules = ruleResults.filter(r => r.status === "FAIL");
  const bestMatch = duplicateMatches[0];
  const isException = decision.status !== "AUTO_PASS";
  const hasDuplicateMatch = duplicateMatches.length > 0;
  const currentAiExplanation = aiExplanation?.transactionId === transaction.id ? aiExplanation.response : null;

  return (
    <div className="space-y-8 relative z-10 pb-20">
      <div className="flex items-center space-x-3 text-sm font-bold text-text-muted">
        <Link href="/exceptions" className="hover:text-text-primary transition-colors">
          Exceptions
        </Link>
        <span className="text-panel-border-hover">/</span>
        <span className="text-text-primary bg-panel px-2.5 py-1 rounded-md border border-panel-border">{transaction.id}</span>
      </div>

      <div className={`card overflow-hidden border-l-8 ${
        decision.status === "HIGH_RISK" ? "border-l-red-500 shadow-[0_0_30px_rgba(239,68,68,0.15)]" :
        decision.status === "REVIEW" ? "border-l-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.15)]" :
        "border-l-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
      }`}>
        <div className="p-6 sm:p-10 relative">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24">
               <path d="M12 2L2 7l10 5 10-5-10-5zm0 7.5L3.5 7 12 2.75 20.5 7 12 9.5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          
          <div className="relative z-10">
            {policySnapshot && <p className="mb-4 text-xs font-bold text-brand-primary">Policy: {policySnapshot.policyName} v{policySnapshot.version}</p>}
            <div className="flex items-center gap-4 mb-6">
              <StatusBadge status={decision.status} />
              <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">
                {decision.headline}
              </h1>
            </div>
            
            <div className="flex flex-wrap gap-x-12 gap-y-6 text-sm bg-slate-50 border border-panel-border rounded-xl p-6 w-fit shadow-sm">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Invoice</span>
                <span className="text-lg font-bold text-text-primary">{transaction.invoiceNumber || "-"}</span>
              </div>
              <div className="flex flex-col gap-2 max-w-[150px] sm:max-w-[200px]">
                <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Vendor</span>
                <span className="text-lg font-bold text-text-primary truncate" title={transaction.vendorName || undefined}>{transaction.vendorName || "-"}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Amount</span>
                <span className="text-lg font-heading font-semibold text-brand-primary">
                  {typeof transaction.amount === "number" && Number.isFinite(transaction.amount)
                    ? formatCurrency(transaction.amount, transaction.currency ?? "INR")
                    : "-"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          {/* Policy Exceptions */}
          {failedRules.length > 0 && (
            <div className="card p-6 lg:p-8">
              <h3 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-3">
                <div className="bg-red-500/20 p-2 rounded-lg ring-1 ring-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                  <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                Policy Violations
              </h3>
              <ul className="space-y-5">
                {failedRules.map((rule, idx) => (
                  <li key={idx} className="bg-slate-50/50 rounded-xl p-6 border border-panel-border shadow-sm relative overflow-hidden">
                    <div className={`absolute left-0 top-0 w-1 h-full ${rule.severity === "HIGH" ? "bg-red-500" : "bg-amber-500"}`}></div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-lg font-bold text-text-primary">{rule.ruleName}</span>
                      <span className={`text-xs px-3 py-1 rounded-md font-extrabold tracking-widest uppercase shadow-sm ${
                        rule.severity === "HIGH" ? "bg-status-danger-bg text-status-danger-text border border-status-danger-border" : "bg-status-warning-bg text-status-warning-text border border-status-warning-border"
                      }`}>
                        {rule.severity}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed mb-6">{rule.explanation}</p>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="bg-white border border-panel-border rounded-lg p-4 shadow-sm">
                        <div className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1.5">Expected Limit</div>
                        <div className="font-heading font-semibold text-text-primary text-lg">{formatRuleValue(rule, rule.expectedValue, transaction.currency ?? "INR")}</div>
                      </div>
                      <div className="bg-status-danger-bg border border-status-danger-border rounded-lg p-4 shadow-sm">
                        <div className="text-xs font-bold text-status-danger-text uppercase tracking-widest mb-1.5">Actual Value</div>
                        <div className="font-heading font-semibold text-status-danger-text text-lg">{formatRuleValue(rule, rule.actualValue, transaction.currency ?? "INR")}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Duplicate Evidence */}
          {bestMatch && matchedTransaction && (
            <div className="card overflow-hidden">
              <div className="bg-slate-100/50 border-b border-panel-border px-6 py-5 flex items-center justify-between">
                <h3 className="text-xl font-bold text-text-primary flex items-center gap-3">
                  <div className="bg-amber-500/10 p-2 rounded-lg ring-1 ring-amber-500/30 shadow-sm">
                    <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  Duplicate Candidate Comparison
                </h3>
              </div>
              
              <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-panel-border">
                {/* Current Record */}
                <div className="w-full sm:w-1/2 p-6 sm:p-8 space-y-6 bg-slate-50/50 relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-brand-primary shadow-[0_0_10px_var(--color-brand-glow)]"></div>
                  <h4 className="text-xs font-extrabold text-brand-primary uppercase tracking-widest mb-4">Current Record</h4>
                  
                  <div className="space-y-1">
                    <div className="text-text-muted text-xs font-bold uppercase tracking-widest">Invoice</div>
                    <div className="text-base font-bold text-text-primary truncate max-w-[150px] sm:max-w-xs" title={transaction.invoiceNumber || undefined}>{transaction.invoiceNumber || "-"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-text-muted text-xs font-bold uppercase tracking-widest">Vendor</div>
                    <div className="text-base font-bold text-text-primary truncate max-w-[150px] sm:max-w-xs" title={transaction.vendorName || undefined}>{transaction.vendorName || "-"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-text-muted text-xs font-bold uppercase tracking-widest">Amount</div>
                    <div className={`text-lg font-heading font-semibold py-1 px-3 -ml-3 rounded-lg inline-block transition-colors ${bestMatch.amountMatch ? "bg-amber-100 text-amber-700 border border-amber-200" : "text-text-primary"}`}>
                      {typeof transaction.amount === "number" && Number.isFinite(transaction.amount)
                        ? formatCurrency(transaction.amount, transaction.currency ?? "INR")
                        : "-"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-text-muted text-xs font-bold uppercase tracking-widest">Invoice Date</div>
                    <div className="text-base font-bold text-text-primary">{transaction.invoiceDate || "-"}</div>
                  </div>
                  <div className="space-y-1 pt-2">
                    <div className="text-text-muted text-[10px] font-bold uppercase tracking-widest">Transaction ID</div>
                    <div className="text-xs font-mono text-text-muted bg-white border border-panel-border px-2 py-1 rounded inline-block shadow-sm">{transaction.id}</div>
                  </div>
                </div>

                {/* Matched Record */}
                <div className="w-full sm:w-1/2 p-6 sm:p-8 space-y-6 bg-amber-50/50 relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 shadow-sm"></div>
                  <h4 className="text-xs font-extrabold text-amber-600 uppercase tracking-widest mb-4">Matched Record</h4>

                  <div className="space-y-1">
                    <div className="text-text-muted text-xs font-bold uppercase tracking-widest">Invoice</div>
                    <div className="text-base font-bold text-text-primary truncate max-w-[150px] sm:max-w-xs" title={matchedTransaction.invoiceNumber || undefined}>{matchedTransaction.invoiceNumber || "-"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-text-muted text-xs font-bold uppercase tracking-widest">Vendor</div>
                    <div className="text-base font-bold text-text-primary truncate max-w-[150px] sm:max-w-xs" title={matchedTransaction.vendorName || undefined}>{matchedTransaction.vendorName || "-"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-text-muted text-xs font-bold uppercase tracking-widest">Amount</div>
                    <div className={`text-lg font-heading font-semibold py-1 px-3 -ml-3 rounded-lg inline-block transition-colors ${bestMatch.amountMatch ? "bg-amber-100 text-amber-700 border border-amber-200" : "text-text-primary"}`}>
                      {typeof matchedTransaction.amount === "number" && Number.isFinite(matchedTransaction.amount)
                        ? formatCurrency(matchedTransaction.amount, matchedTransaction.currency ?? "INR")
                        : "-"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-text-muted text-xs font-bold uppercase tracking-widest">Invoice Date</div>
                    <div className="text-base font-bold text-text-primary">{matchedTransaction.invoiceDate || "-"}</div>
                  </div>
                  <div className="space-y-1 pt-2">
                    <div className="text-text-muted text-[10px] font-bold uppercase tracking-widest">Transaction ID</div>
                    <div className="text-xs font-mono text-text-muted bg-white border border-panel-border px-2 py-1 rounded inline-block shadow-sm">{matchedTransaction.id}</div>
                  </div>
                </div>
              </div>
              
              {/* Evidence details */}
              {bestMatch.evidence.length > 0 && (
                <div className="bg-slate-50 border-t border-panel-border p-6 sm:p-8">
                  <h4 className="text-sm font-bold text-text-primary uppercase tracking-widest mb-4">Algorithm Evidence</h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {bestMatch.evidence.map((ev, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-sm font-medium text-text-secondary bg-white px-4 py-3 rounded-xl border border-panel-border shadow-sm">
                        <div className="bg-status-success-bg rounded-full p-1 border border-status-success-border flex-shrink-0">
                          <svg className="w-4 h-4 text-status-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        {ev}
                      </li>
                    ))}
                    {bestMatch.vendorSimilarity !== null && bestMatch.matchType !== "EXACT" && (
                       <li className="flex items-center gap-3 text-sm font-medium text-text-secondary bg-white px-4 py-3 rounded-xl border border-panel-border shadow-sm">
                         <div className="bg-status-success-bg rounded-full p-1 border border-status-success-border flex-shrink-0">
                           <svg className="w-4 h-4 text-status-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                         </div>
                         Vendor similarity: <span className="text-text-primary font-bold">{bestMatch.vendorSimilarity}%</span>
                       </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {decision.recommendedAction && (
            <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-2xl p-6 flex gap-4 shadow-[0_0_30px_rgba(59,130,246,0.15)] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                 <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div className="bg-brand-primary/20 p-2.5 rounded-xl border border-brand-primary/40 flex-shrink-0 self-start z-10">
                <svg className="w-6 h-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="z-10">
                <h4 className="text-sm font-extrabold text-brand-primary tracking-widest uppercase">System Recommendation</h4>
                <p className="text-lg font-medium text-text-primary mt-2">
                  {decision.recommendedAction}
                </p>
              </div>
            </div>
          )}

          <section className="card p-6 lg:p-8 border-brand-primary/30" aria-labelledby="azure-ai-explanation-title">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="bg-brand-primary/15 p-3 rounded-xl border border-brand-primary/30 flex-shrink-0 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                  <svg className="w-6 h-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8L12 3zm6 11l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14z" />
                  </svg>
                </div>
                <div>
                  <h3 id="azure-ai-explanation-title" className="text-xl font-bold text-text-primary">Azure AI Evidence Explanation</h3>
                  <p className="mt-1 text-sm text-text-secondary">Powered by Microsoft Azure OpenAI</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-primary sm:flex-shrink-0 disabled:opacity-60 disabled:cursor-wait"
                onClick={() => void handleAzureExplanation()}
                disabled={isAiLoading}
              >
                {isAiLoading && <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" /></svg>}
                {isAiLoading ? "Analyzing..." : currentAiExplanation ? "Regenerate" : "Explain with Azure AI"}
              </button>
            </div>

            <div className="mt-6" aria-live="polite">
              {isAiLoading && <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-5 text-sm text-text-secondary">Azure AI is reviewing the existing evidence...</div>}
              {!isAiLoading && aiError && <div role="alert" className="rounded-xl border border-status-danger-border bg-status-danger-bg p-5 text-sm font-semibold text-status-danger-text">{aiError}</div>}
              {!isAiLoading && !aiError && currentAiExplanation && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-panel-border bg-black/30 p-5 sm:p-6">
                    <p className="text-base leading-7 text-text-primary whitespace-pre-wrap">{currentAiExplanation.explanation}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["Azure Functions", "Azure OpenAI", "Human decision required"].map((badge) => <span key={badge} className="rounded-full border border-brand-primary/20 bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">{badge}</span>)}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3 rounded-xl border border-panel-border bg-black/20 p-4">
              <svg className="w-5 h-5 text-text-muted flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 4.5h.008v.008H12V16.5z" /></svg>
              <p className="text-xs leading-5 text-text-muted">AI explains the system evidence only. It does not approve, reject, or change the transaction status.</p>
            </div>
          </section>

          <div className="card p-6 lg:p-8">
            <h3 className="text-xl font-bold text-text-primary mb-6">
              Reviewer Decision
            </h3>
            {isException ? (
              <>
                <p className="text-sm text-text-secondary mb-6">
                  Record the reviewer outcome. The original system finding remains intact for a complete audit trail.
                </p>

                <div className="mb-8">
              <label htmlFor="note" className="block text-sm font-bold text-text-secondary uppercase tracking-widest mb-3">
                Audit Note (Optional)
              </label>
              <input
                type="text"
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Provide context for the audit log..."
                className="w-full rounded-xl bg-slate-50 border border-panel-border px-5 py-4 text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all shadow-sm"
                disabled={isProcessing}
              />
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => handleAction("APPROVE")}
                disabled={isProcessing}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-panel disabled:opacity-50 text-white font-extrabold py-4 px-4 rounded-xl shadow-sm transition-all uppercase tracking-widest active:scale-95"
              >
                Approve
              </button>
              <button
                onClick={() => handleAction("REJECT")}
                disabled={isProcessing}
                className="flex-1 bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-panel disabled:opacity-50 text-white font-extrabold py-4 px-4 rounded-xl shadow-sm transition-all uppercase tracking-widest active:scale-95"
              >
                Reject
              </button>
              {hasDuplicateMatch && (
                <button
                onClick={() => handleAction("MARK_NOT_DUPLICATE")}
                disabled={isProcessing}
                className="sm:w-auto bg-white hover:bg-slate-50 focus:ring-2 focus:ring-text-muted focus:ring-offset-2 focus:ring-offset-panel disabled:opacity-50 text-text-primary border border-panel-border font-extrabold py-4 px-8 rounded-xl shadow-sm transition-all uppercase tracking-widest active:scale-95"
              >
                Not Duplicate
                </button>
              )}
                </div>
              </>
            ) : (
              <p className="text-sm text-text-secondary">
                This transaction was auto-cleared. No reviewer action is required.
              </p>
            )}
            
            {message && (
              <div className={`mt-6 p-4 rounded-xl text-sm font-bold flex items-center gap-3 ${message.type === "success" ? "bg-status-success-bg text-status-success-text border border-status-success-border shadow-[0_0_20px_rgba(16,185,129,0.1)]" : "bg-status-danger-bg text-status-danger-text border border-status-danger-border shadow-[0_0_20px_rgba(239,68,68,0.1)]"}`}>
                <div className={`p-1 rounded-full ${message.type === "success" ? "bg-status-success-border text-status-success-text" : "bg-status-danger-border text-status-danger-text"}`}>
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    {message.type === "success" ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    )}
                  </svg>
                </div>
                {message.text}
              </div>
            )}
            <details className="mt-5 text-sm text-text-muted">
              <summary className="cursor-pointer font-bold">Keyboard shortcuts</summary>
              <p className="mt-2">A approve · R reject · N mark not duplicate. Shortcuts are disabled while typing.</p>
            </details>
          </div>

          <div className="card p-6 lg:p-8">
            <h3 className="text-xl font-bold text-text-primary mb-5">Source Traceability</h3>
            <dl className="grid sm:grid-cols-3 gap-5">
              <div><dt className="text-xs uppercase tracking-widest text-text-muted">Source File</dt><dd className="mt-2 font-bold break-all">{transaction.sourceFile}</dd></div>
              <div><dt className="text-xs uppercase tracking-widest text-text-muted">Source Sheet</dt><dd className="mt-2 font-bold">{transaction.sourceSheet ?? "-"}</dd></div>
              <div><dt className="text-xs uppercase tracking-widest text-text-muted">Source Row</dt><dd className="mt-2 font-bold">{transaction.sourceRow}</dd></div>
            </dl>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-24">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-8 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Audit History
            </h3>
            <AuditTimeline events={auditEvents} />
          </div>
        </div>
      </div>
    </div>
  );
}

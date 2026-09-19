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
import { applyReviewAction } from "@/core/audit";
import {
  getTransaction,
  getDecision,
  getRuleResults,
  getDuplicateMatches,
  getAuditEvents,
} from "@/lib/storage";

export default function ExceptionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [ruleResults, setRuleResults] = useState<RuleResult[]>([]);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [matchedTransaction, setMatchedTransaction] = useState<Transaction | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [note, setNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const loadData = () => {
    const t = getTransaction(id);
    if (t) {
      setTransaction(t);
      setDecision(getDecision(id) || null);
      setRuleResults(getRuleResults(id));
      
      const matches = getDuplicateMatches(id);
      setDuplicateMatches(matches);
      
      const events = getAuditEvents(id);
      // Sort chronologically (oldest first)
      events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setAuditEvents(events);

      if (matches.length > 0) {
        // Load strongest match for evidence display
        const bestMatch = matches[0];
        setMatchedTransaction(getTransaction(bestMatch.matchedTransactionId) || null);
      }
    } else {
      setTransaction(null);
      setDecision(null);
      setRuleResults([]);
      setDuplicateMatches([]);
      setAuditEvents([]);
      setMatchedTransaction(null);
    }
    setHasLoaded(true);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAction = (action: "APPROVE" | "REJECT" | "MARK_NOT_DUPLICATE") => {
    if (isProcessing) return;
    setIsProcessing(true);
    setMessage(null);

    const result = applyReviewAction({
      transactionId: id,
      action,
      reviewer: "Finance Reviewer",
      note: note.trim() || undefined,
    });

    if (result) {
      setMessage({ text: "Decision recorded.", type: "success" });
      setNote("");
      loadData(); // Reload data to show new audit event
    } else {
      setMessage({ text: "Failed to record decision.", type: "error" });
    }
    
    setIsProcessing(false);
  };

  if (!hasLoaded) {
    return (
      <div className="flex justify-center p-12">
        <div className="text-slate-500">Loading exception details...</div>
      </div>
    );
  }

  if (!transaction || !decision) {
    return (
      <div className="max-w-3xl mx-auto mt-10 text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Exception not found.
        </h2>
        <Link href="/exceptions" className="text-blue-600 hover:underline">
          Return to the exception queue.
        </Link>
      </div>
    );
  }

  const failedRules = ruleResults.filter(r => r.status === "FAIL");
  const bestMatch = duplicateMatches[0]; // Assuming strongest is first, per core logic

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-slate-500">
        <Link href="/exceptions" className="hover:text-slate-900">
          Exceptions
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900">{transaction.id}</span>
      </div>

      <div className={`bg-white border-l-8 border-y border-r border-slate-200/75 p-6 sm:p-8 rounded-r-xl shadow-sm ${
        decision.status === "HIGH_RISK" ? "border-l-red-500" :
        decision.status === "REVIEW" ? "border-l-amber-400" :
        "border-l-emerald-500"
      }`}>
        <div className="flex flex-col">
          <div className="flex items-center gap-3 mb-5">
            <StatusBadge status={decision.status} />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {decision.headline}
            </h1>
          </div>
          <div className="flex flex-wrap gap-x-12 gap-y-4 text-sm bg-slate-50 border border-slate-200/60 rounded-lg p-5 w-fit">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice</span>
              <span className="text-base font-semibold text-slate-900">{transaction.invoiceNumber || "-"}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor</span>
              <span className="text-base font-semibold text-slate-900">{transaction.vendorName || "-"}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</span>
              <span className="text-base font-semibold text-slate-900">
                {typeof transaction.amount === "number" && Number.isFinite(transaction.amount)
                  ? `₹${transaction.amount.toLocaleString()}`
                  : "-"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* Policy Exceptions */}
          {failedRules.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/75 shadow-sm p-6 lg:p-8">
              <h3 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Policy Violations
              </h3>
              <ul className="space-y-4">
                {failedRules.map((rule, idx) => (
                  <li key={idx} className="bg-slate-50 rounded-lg p-5 border border-slate-200/60 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-base font-semibold text-slate-900">{rule.ruleName}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-md font-semibold tracking-wide uppercase ${
                        rule.severity === "HIGH" ? "bg-red-100 text-red-800 ring-1 ring-inset ring-red-600/20" : "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-600/20"
                      }`}>
                        {rule.severity}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed mb-4">{rule.explanation}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white border border-slate-200 rounded-md p-3 shadow-sm">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Expected Limit</div>
                        <div className="font-semibold text-slate-700">{String(rule.expectedValue)}</div>
                      </div>
                      <div className="bg-red-50 border border-red-100 rounded-md p-3 shadow-sm">
                        <div className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1">Actual Value</div>
                        <div className="font-semibold text-red-900">{String(rule.actualValue)}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Duplicate Evidence */}
          {bestMatch && matchedTransaction && (
            <div className="bg-white rounded-xl border border-slate-200/75 shadow-sm overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200/75 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Duplicate Candidate Comparison
                </h3>
              </div>
              <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-200/75">
                <div className="w-full sm:w-1/2 p-6 space-y-5 bg-white relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Current Record</h4>
                  
                  <div>
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Invoice</div>
                    <div className="text-base font-semibold text-slate-900">{transaction.invoiceNumber || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Vendor</div>
                    <div className="text-base font-semibold text-slate-900">{transaction.vendorName || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Amount</div>
                    <div className={`text-base font-bold py-0.5 px-2 -ml-2 rounded-md inline-block ${bestMatch.amountMatch ? "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-600/20" : "text-slate-900"}`}>
                      {typeof transaction.amount === "number" && Number.isFinite(transaction.amount)
                        ? `₹${transaction.amount.toLocaleString()}`
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Invoice Date</div>
                    <div className="text-base font-medium text-slate-900">{transaction.invoiceDate || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Transaction ID</div>
                    <div className="text-sm font-medium text-slate-500">{transaction.id}</div>
                  </div>
                </div>

                <div className="w-full sm:w-1/2 p-6 space-y-5 bg-slate-50/50 relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-amber-400"></div>
                  <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Matched Record</h4>

                  <div>
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Invoice</div>
                    <div className="text-base font-semibold text-slate-900">{matchedTransaction.invoiceNumber || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Vendor</div>
                    <div className="text-base font-semibold text-slate-900">{matchedTransaction.vendorName || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Amount</div>
                    <div className={`text-base font-bold py-0.5 px-2 -ml-2 rounded-md inline-block ${bestMatch.amountMatch ? "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-600/20" : "text-slate-900"}`}>
                      {typeof matchedTransaction.amount === "number" && Number.isFinite(matchedTransaction.amount)
                        ? `₹${matchedTransaction.amount.toLocaleString()}`
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Invoice Date</div>
                    <div className="text-base font-medium text-slate-900">{matchedTransaction.invoiceDate || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Transaction ID</div>
                    <div className="text-sm font-medium text-slate-500">{matchedTransaction.id}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Why this was flagged */}
          {bestMatch && bestMatch.evidence.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/75 shadow-sm p-6 lg:p-8">
              <h3 className="text-lg font-bold text-slate-900 mb-5">
                Match Evidence
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                {bestMatch.evidence.map((ev, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-sm font-medium text-slate-700 bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-100">
                    <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {ev}
                  </li>
                ))}
                {bestMatch.vendorSimilarity !== null && bestMatch.matchType !== "EXACT" && (
                   <li className="flex items-center gap-3 text-sm font-medium text-slate-700 bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-100">
                     <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                     Vendor string similarity: {bestMatch.vendorSimilarity}%
                   </li>
                )}
              </ul>
            </div>
          )}

          {decision.recommendedAction && (
            <div className="bg-blue-50/80 border border-blue-200/75 rounded-xl p-5 flex gap-3.5 shadow-sm">
              <div className="mt-0.5">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-blue-900 tracking-wide uppercase">Recommended action</h4>
                <p className="text-base font-medium text-blue-900/90 mt-1">
                  {decision.recommendedAction}
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200/75 shadow-sm p-6 lg:p-8 mt-6">
            <h3 className="text-lg font-bold text-slate-900 mb-5">
              Reviewer Action
            </h3>
            
            <div className="mb-6">
              <label htmlFor="note" className="block text-sm font-semibold text-slate-700 mb-2">
                Audit Note (Optional)
              </label>
              <input
                type="text"
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add context to your decision for the audit log..."
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                disabled={isProcessing}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => handleAction("APPROVE")}
                disabled={isProcessing}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg shadow-sm transition-all"
              >
                APPROVE
              </button>
              <button
                onClick={() => handleAction("REJECT")}
                disabled={isProcessing}
                className="flex-1 bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg shadow-sm transition-all"
              >
                REJECT
              </button>
              <button
                onClick={() => handleAction("MARK_NOT_DUPLICATE")}
                disabled={isProcessing}
                className="sm:w-auto bg-white hover:bg-slate-50 focus:ring-2 focus:ring-slate-200 focus:ring-offset-2 disabled:opacity-50 text-slate-700 border border-slate-300 font-semibold py-3 px-6 rounded-lg shadow-sm transition-all"
              >
                MARK NOT DUPLICATE
              </button>
            </div>
            
            {message && (
              <div className={`mt-5 p-3 rounded-md text-sm font-bold flex items-center gap-2 ${message.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  {message.type === "success" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  )}
                </svg>
                {message.text}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 sticky top-6">
            <h3 className="text-base font-semibold text-slate-900 mb-6">
              Audit History
            </h3>
            <AuditTimeline events={auditEvents} />
          </div>
        </div>
      </div>
    </div>
  );
}

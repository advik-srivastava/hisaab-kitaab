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

      <div className={`bg-white border-l-4 border-y border-r border-slate-200 p-6 rounded-r-lg shadow-sm ${
        decision.status === "HIGH_RISK" ? "border-l-red-500" :
        decision.status === "REVIEW" ? "border-l-amber-400" :
        "border-l-green-500"
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge status={decision.status} />
              <h1 className="text-xl font-semibold text-slate-900">
                {decision.headline}
              </h1>
            </div>
            <div className="flex gap-6 mt-4 text-sm">
              <div>
                <span className="text-slate-500">Invoice:</span>{" "}
                <span className="font-medium text-slate-900">{transaction.invoiceNumber || "-"}</span>
              </div>
              <div>
                <span className="text-slate-500">Vendor:</span>{" "}
                <span className="font-medium text-slate-900">
                  {transaction.vendorName || "-"}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Amount:</span>{" "}
                <span className="font-medium text-slate-900">
                  {typeof transaction.amount === "number" && Number.isFinite(transaction.amount)
                    ? `₹${transaction.amount.toLocaleString()}`
                    : "-"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* Policy Exceptions */}
          {failedRules.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-slate-900 mb-4">
                Policy Violations
              </h3>
              <ul className="space-y-4">
                {failedRules.map((rule, idx) => (
                  <li key={idx} className="bg-slate-50 rounded-md p-4 border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-slate-900">{rule.ruleName}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        rule.severity === "HIGH" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {rule.severity}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{rule.explanation}</p>
                    <div className="mt-3 text-xs text-slate-500 flex gap-4">
                      <div><span className="font-medium text-slate-600">Expected:</span> {String(rule.expectedValue)}</div>
                      <div><span className="font-medium text-slate-600">Actual:</span> {String(rule.actualValue)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Duplicate Evidence */}
          {bestMatch && matchedTransaction && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex">
                <div className="w-1/2 font-semibold text-slate-900">
                  CURRENT RECORD
                </div>
                <div className="w-1/2 font-semibold text-slate-900 border-l border-slate-300 pl-6">
                  MATCHED RECORD
                </div>
              </div>
              <div className="flex divide-x divide-slate-200 text-sm">
                <div className="w-1/2 p-6 space-y-4">
                  <div>
                    <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Invoice</div>
                    <div className="font-medium text-slate-900">{transaction.invoiceNumber || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Vendor</div>
                    <div className="font-medium text-slate-900">{transaction.vendorName || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Amount</div>
                    <div className={`font-medium py-0.5 px-2 rounded-sm inline-block ${bestMatch.amountMatch ? "bg-red-50 text-red-700" : "text-slate-900"}`}>
                      {typeof transaction.amount === "number" && Number.isFinite(transaction.amount)
                        ? `₹${transaction.amount.toLocaleString()}`
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Invoice Date</div>
                    <div className="font-medium text-slate-900">{transaction.invoiceDate || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Transaction ID</div>
                    <div className="font-medium text-slate-900">{transaction.id}</div>
                  </div>
                </div>

                <div className="w-1/2 p-6 space-y-4 bg-slate-50/50">
                  <div>
                    <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Invoice</div>
                    <div className="font-medium text-slate-900">{matchedTransaction.invoiceNumber || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Vendor</div>
                    <div className="font-medium text-slate-900">{matchedTransaction.vendorName || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Amount</div>
                    <div className={`font-medium py-0.5 px-2 rounded-sm inline-block ${bestMatch.amountMatch ? "bg-red-50 text-red-700" : "text-slate-900"}`}>
                      {typeof matchedTransaction.amount === "number" && Number.isFinite(matchedTransaction.amount)
                        ? `₹${matchedTransaction.amount.toLocaleString()}`
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Invoice Date</div>
                    <div className="font-medium text-slate-900">{matchedTransaction.invoiceDate || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Transaction ID</div>
                    <div className="font-medium text-slate-900">{matchedTransaction.id}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Why this was flagged */}
          {bestMatch && bestMatch.evidence.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-slate-900 mb-4">
                Duplicate Evidence
              </h3>
              <ul className="space-y-3 mb-6">
                {bestMatch.evidence.map((ev, idx) => (
                  <li key={idx} className="flex items-center text-sm text-slate-700">
                    <svg className="w-5 h-5 text-amber-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {ev}
                  </li>
                ))}
                {bestMatch.vendorSimilarity !== null && bestMatch.matchType !== "EXACT" && (
                   <li className="flex items-center text-sm text-slate-700">
                     <svg className="w-5 h-5 text-amber-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                     Vendor string similarity: {bestMatch.vendorSimilarity}%
                   </li>
                )}
              </ul>
            </div>
          )}

          {decision.recommendedAction && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-blue-900">Recommended action</h4>
                <p className="text-sm text-blue-800 mt-1">
                  {decision.recommendedAction}
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mt-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4">
              Reviewer Action
            </h3>
            
            <div className="mb-4">
              <label htmlFor="note" className="block text-sm font-medium text-slate-700 mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add context to your decision..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isProcessing}
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => handleAction("APPROVE")}
                disabled={isProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-2.5 px-4 rounded-md shadow-sm transition-colors"
              >
                APPROVE
              </button>
              <button
                onClick={() => handleAction("REJECT")}
                disabled={isProcessing}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-2.5 px-4 rounded-md shadow-sm transition-colors"
              >
                REJECT
              </button>
              <button
                onClick={() => handleAction("MARK_NOT_DUPLICATE")}
                disabled={isProcessing}
                className="flex-1 bg-white hover:bg-slate-50 disabled:bg-slate-100 text-slate-700 border border-slate-300 font-semibold py-2.5 px-4 rounded-md shadow-sm transition-colors"
              >
                MARK NOT DUPLICATE
              </button>
            </div>
            
            {message && (
              <div className={`mt-4 text-sm font-medium ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
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

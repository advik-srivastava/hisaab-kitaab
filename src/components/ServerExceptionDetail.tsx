"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { useAuth } from "./AuthProvider";
import { formatCurrency } from "@/lib/formatting";
import type { ExceptionPage, ReviewAction, ServerExceptionDetail, UserRecord } from "@/server/platform/types";

function typingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

export function ServerExceptionDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [detail, setDetail] = useState<ServerExceptionDetail>();
  const [neighbors, setNeighbors] = useState<{ previous?: string; next?: string }>({});
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>();
  const [users, setUsers] = useState<UserRecord[]>([]);

  // AI Explanation State
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const load = async () => {
    const [detailResponse, queueResponse] = await Promise.all([
      fetch(`/api/exceptions/${encodeURIComponent(id)}`, { cache: "no-store" }),
      fetch("/api/exceptions?pageSize=200", { cache: "no-store" }),
    ]);
    if (!detailResponse.ok) throw new Error("Exception could not be loaded.");
    const loaded = await detailResponse.json() as ServerExceptionDetail;
    setDetail(loaded);
    if (queueResponse.ok) {
      const queue = await queueResponse.json() as ExceptionPage;
      const index = queue.items.findIndex(({ transaction }) => transaction.id === id);
      setNeighbors({ previous: queue.items[index - 1]?.transaction.id, next: queue.items[index + 1]?.transaction.id });
    }
  };

  useEffect(() => {
    let active = true;
    void load().catch((caught) => { if (active) setMessage(caught instanceof Error ? caught.message : "Exception could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (user?.role !== "ADMIN" && user?.role !== "FINANCE_MANAGER") return;
    void fetch("/api/users", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { items: [] })
      .then((body: { items: UserRecord[] }) => setUsers(body.items));
  }, [user?.role]);

  const submit = async (action: ReviewAction) => {
    if (!detail || loading) return;
    setLoading(true);
    setMessage(undefined);
    try {
      const response = await fetch(`/api/exceptions/${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation: "REVIEW", action, note, expectedVersion: detail.version }),
      });
      const body = await response.json() as ServerExceptionDetail & { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Review could not be saved.");
      setMessage("Review saved.");
      setNote("");
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Review could not be saved.");
    } finally {
      setLoading(false);
    }
  };

  const assign = async (reviewerId: string) => {
    if (!detail || !reviewerId || loading || !window.confirm(`Assign this exception to the selected reviewer?`)) return;
    setLoading(true);
    const response = await fetch(`/api/exceptions/${encodeURIComponent(id)}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "ASSIGN", reviewerId, expectedVersion: detail.version }),
    });
    const body = await response.json() as { error?: { message?: string } };
    setMessage(response.ok ? "Reviewer assignment saved." : body.error?.message ?? "Assignment could not be saved.");
    if (response.ok) await load();
    setLoading(false);
  };

  const explainEvidence = () => {
    setIsAiLoading(true);
    // Simulate AI delay
    setTimeout(() => {
      setAiExplanation("The invoice exceeds the configured limit by a significant amount. A previous invoice from this vendor with the same amount was also detected three days earlier, increasing the likelihood of duplication.");
      setIsAiLoading(false);
    }, 1500);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || typingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "a") void submit("APPROVE");
      if (key === "r") void submit("REJECT");
      if (key === "n") void submit("MARK_NOT_DUPLICATE");
      if ((key === "j" || event.key === "ArrowDown") && neighbors.next) router.push(`/exceptions/${neighbors.next}`);
      if ((key === "k" || event.key === "ArrowUp") && neighbors.previous) router.push(`/exceptions/${neighbors.previous}`);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (loading && !detail) return <div className="min-h-[50vh] flex items-center justify-center"><p className="text-text-secondary animate-pulse">Loading transaction workspace...</p></div>;
  if (!detail) return <div className="text-center p-20"><p className="text-red-500 font-bold mb-4">{message ?? "Exception not found."}</p><Link href="/exceptions" className="btn-secondary">Return to queue</Link></div>;
  
  const { transaction, decision, duplicateMatches, matchedTransaction, failedRules, assignment, review, auditEvents } = detail;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {/* Hero Area */}
      <div>
        <Link href="/exceptions" className="inline-flex items-center text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors mb-6">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Exceptions
        </Link>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge status={decision.status} />
              <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Severity: {decision.status === 'HIGH_RISK' ? 'HIGH' : decision.status === 'REVIEW' ? 'MEDIUM' : 'LOW'}</span>
            </div>
            <h1 className="text-[40px] leading-none font-extrabold tracking-tight text-text-primary">
              {transaction.invoiceNumber ? `Invoice #${transaction.invoiceNumber}` : `Transaction ${transaction.id.substring(0, 8)}`}
            </h1>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[15px]">
              <div>
                <span className="text-text-secondary mr-2">Vendor:</span>
                <span className="font-bold text-text-primary">{transaction.vendorName ?? "Unknown"}</span>
              </div>
              <div>
                <span className="text-text-secondary mr-2">Amount:</span>
                <span className="font-bold text-text-primary">{typeof transaction.amount === "number" ? formatCurrency(transaction.amount, transaction.currency ?? "INR") : "Missing"}</span>
              </div>
              {transaction.invoiceDate && (
                <div>
                  <span className="text-text-secondary mr-2">Date:</span>
                  <span className="font-bold text-text-primary">{new Date(transaction.invoiceDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 shrink-0">
            {message && <p aria-live="polite" className="text-sm font-semibold text-green-600 self-center mr-3">{message}</p>}
            <button className="btn-primary min-w-[120px]" disabled={loading} onClick={() => void submit("APPROVE")}>Approve</button>
            <button className="btn-secondary text-red-600 hover:text-red-700 hover:border-red-200 min-w-[120px]" disabled={loading} onClick={() => void submit("REJECT")}>Reject</button>
            <button className="btn-secondary min-w-[50px] px-0 flex justify-center" disabled={loading} title="More actions">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        {/* Left / Main Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Policy Violations */}
          {failedRules.length > 0 && (
            <div className="card p-8">
              <h2 className="font-bold text-lg mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Policy Violations
              </h2>
              <div className="space-y-4">
                {failedRules.map((rule) => (
                  <div key={rule.ruleId} className="border border-border-subtle rounded-xl p-5 bg-surface-primary/30">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Rule Triggered</p>
                    <p className="font-bold text-[15px] mb-3">{rule.ruleName}</p>
                    <div className="flex gap-10">
                      <div>
                        <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">Expected</p>
                        <p className="text-sm font-semibold">{rule.ruleName.includes('Limit') ? 'Configured Limit' : 'Policy Requirement'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">Actual</p>
                        <p className="text-sm font-semibold text-red-600">{rule.explanation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duplicate Evidence */}
          {duplicateMatches.length > 0 && (
            <div className="card p-8">
              <h2 className="font-bold text-lg mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Duplicate Evidence
              </h2>
              <div className="border border-border-subtle rounded-xl overflow-hidden">
                <div className="grid grid-cols-2 bg-surface-primary border-b border-border-subtle">
                  <div className="p-4 font-bold text-sm text-text-primary">Current Transaction</div>
                  <div className="p-4 font-bold text-sm text-text-primary border-l border-border-subtle">Matched Transaction</div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-border-subtle">
                  <div className="p-5 space-y-4">
                    <div>
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Invoice</p>
                      <p className="font-bold text-sm">{transaction.invoiceNumber ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Vendor</p>
                      <p className="font-bold text-sm">{transaction.vendorName ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Amount</p>
                      <p className="font-bold text-sm">{typeof transaction.amount === "number" ? formatCurrency(transaction.amount, transaction.currency ?? "INR") : "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Date</p>
                      <p className="font-bold text-sm">{transaction.invoiceDate ? new Date(transaction.invoiceDate).toLocaleDateString() : "-"}</p>
                    </div>
                  </div>
                  <div className="p-5 space-y-4 bg-surface-hover/30">
                    <div>
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Invoice</p>
                      <p className="font-bold text-sm">{matchedTransaction?.invoiceNumber ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Vendor</p>
                      <p className="font-bold text-sm">{matchedTransaction?.vendorName ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Amount</p>
                      <p className="font-bold text-sm">{typeof matchedTransaction?.amount === "number" ? formatCurrency(matchedTransaction.amount, matchedTransaction.currency ?? "INR") : "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Date</p>
                      <p className="font-bold text-sm">{matchedTransaction?.invoiceDate ? new Date(matchedTransaction.invoiceDate).toLocaleDateString() : "-"}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-surface-primary border-t border-border-subtle p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Match Analysis</p>
                  <p className="text-sm font-semibold mb-2">System Assessment: <span className="text-amber-600 font-bold">{duplicateMatches[0].matchType} Duplicate</span></p>
                  <ul className="text-sm space-y-1 text-text-secondary">
                    {duplicateMatches[0].evidence.map((evidence, i) => (
                      <li key={i} className="flex gap-2"><span className="text-amber-500">•</span> {evidence}</li>
                    ))}
                  </ul>
                  <div className="mt-4 flex gap-3">
                    <button className="btn-secondary py-1.5 px-4 text-xs font-bold" onClick={() => void submit("MARK_NOT_DUPLICATE")} disabled={loading}>Mark Not Duplicate</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Details (Raw Data) */}
          <div className="card p-8">
            <h2 className="font-bold text-lg mb-5">Transaction Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
              {[
                ["Source File", transaction.sourceFile], 
                ["Source Sheet", transaction.sourceSheet ?? "-"], 
                ["Source Row", transaction.sourceRow],
                ["Department", transaction.department ?? "-"],
                ["Category", transaction.expenseCategory ?? "-"],
                ["PO Number", transaction.purchaseOrder ?? "-"]
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">{label}</p>
                  <p className="font-bold text-[13px]">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right / Sidebar Column */}
        <div className="space-y-6">
          
          {/* AI Explanation Panel */}
          <div className="card p-6 border-purple-200 bg-purple-50">
            <h2 className="font-bold text-[15px] flex items-center gap-2 text-purple-900 mb-2">
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Azure AI Explanation
            </h2>
            <p className="text-[11px] text-purple-700/80 uppercase tracking-widest font-bold mb-4">AI summarizes evidence. Humans decide.</p>
            
            {aiExplanation ? (
              <div className="animate-in fade-in">
                <p className="text-sm text-purple-900 leading-relaxed font-medium">{aiExplanation}</p>
                <div className="mt-4 flex gap-2">
                  <button className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-100 hover:bg-purple-200 px-2 py-1 rounded transition-colors uppercase tracking-wider" onClick={() => navigator.clipboard.writeText(aiExplanation)}>Copy</button>
                  <button className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-100 hover:bg-purple-200 px-2 py-1 rounded transition-colors uppercase tracking-wider" onClick={explainEvidence}>Regenerate</button>
                </div>
              </div>
            ) : isAiLoading ? (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="w-6 h-6 rounded-full bg-purple-300 animate-ping opacity-75 mb-3"></div>
                <p className="text-xs font-bold text-purple-700 uppercase tracking-widest animate-pulse">Generating...</p>
              </div>
            ) : (
              <button 
                onClick={explainEvidence}
                className="w-full mt-2 inline-flex items-center justify-center rounded bg-purple-600 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-purple-700"
              >
                Explain Evidence
              </button>
            )}
          </div>

          {/* System Recommendation */}
          <div className="card p-6">
            <h2 className="font-bold text-[15px] mb-2 uppercase tracking-widest text-text-muted text-[11px]">System Recommendation</h2>
            <p className="font-bold text-base text-text-primary mb-2">Manual Review Recommended</p>
            <p className="text-sm text-text-secondary">{decision.headline}</p>
          </div>

          {/* Assignment & Audit */}
          <div className="card p-6">
            <h2 className="font-bold text-[15px] mb-4">Audit History</h2>
            
            <div className="mb-6 pb-6 border-b border-border-subtle">
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">Assignment</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">{assignment ? assignment.reviewerId : "Unassigned"}</p>
                  {assignment && <p className="text-[11px] text-text-secondary mt-1">Assigned {new Date(assignment.assignedAt).toLocaleDateString()}</p>}
                </div>
                {(user?.role === "ADMIN" || user?.role === "FINANCE_MANAGER") && (
                  <select 
                    aria-label="Assign reviewer" 
                    className="rounded bg-surface-primary border border-border-default px-2 py-1 text-xs font-semibold" 
                    value={assignment?.reviewerId ?? ""} 
                    onChange={(event) => void assign(event.target.value)} 
                    disabled={loading}
                  >
                    <option value="">Assign...</option>
                    {users.filter(({ role }) => role !== "AUDITOR").map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>{candidate.displayName}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="relative border-l-2 border-border-subtle ml-2 pl-4 pb-2 space-y-5">
              {auditEvents.map((event) => (
                <div key={event.id} className="relative">
                  <div className="absolute -left-[23px] top-1 w-[10px] h-[10px] rounded-full bg-border-default ring-4 ring-surface-elevated"></div>
                  <p className="font-bold text-sm text-text-primary capitalize">{event.action.toLowerCase().replace('_', ' ')}</p>
                  <p className="text-[11px] text-text-secondary font-semibold uppercase tracking-wider mt-1">{new Date(event.timestamp).toLocaleString()} · {event.actorId ?? "SYSTEM"}</p>
                  {event.note && <p className="text-sm text-text-secondary mt-2 bg-surface-primary p-3 rounded-lg border border-border-subtle">{event.note}</p>}
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-6 border-t border-border-subtle">
              <textarea 
                aria-label="Review note" 
                className="w-full rounded-lg bg-surface-primary border border-border-default p-3 text-sm focus-visible:ring-1 focus-visible:ring-neutral-900" 
                value={note} 
                onChange={(event) => setNote(event.target.value)} 
                placeholder="Add optional audit note..." 
                rows={2}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { useAuth } from "./AuthProvider";
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((caught) => { if (active) setMessage(caught instanceof Error ? caught.message : "Exception could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (user?.role !== "ADMIN" && user?.role !== "FINANCE_MANAGER") return;
    void fetch("/api/users", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { items: [] })
      .then((body: { items: UserRecord[] }) => setUsers(body.items));
  }, [user?.role]);

  const submit = async (action: ReviewAction) => {
    if (!detail || loading) return;
    if ((action === "REJECT" || action === "MARK_NOT_DUPLICATE") && !window.confirm(`Confirm ${action.replaceAll("_", " ")}?`)) return;
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

  if (loading && !detail) return <p className="p-12 text-center text-text-secondary">Loading transaction...</p>;
  if (!detail) return <div className="text-center"><p className="text-status-danger-text">{message ?? "Exception not found."}</p><Link href="/exceptions" className="text-brand-primary">Return to queue</Link></div>;
  const { transaction, decision, duplicateMatches, matchedTransaction, failedRules, assignment, review, auditEvents } = detail;
  return (
    <div className="space-y-8 pb-16">
      <div className="flex justify-between items-start"><div><Link href="/exceptions" className="text-sm text-brand-primary">← Exception Queue</Link><div className="mt-4 flex gap-3 items-center"><StatusBadge status={decision.status} /><h1 className="text-3xl font-extrabold">{decision.headline}</h1></div><p className="mt-3 text-text-secondary">{decision.summary}</p></div><div className="text-right text-xs text-text-muted"><p>Version {detail.version}</p><p>{assignment ? `Assigned to ${assignment.reviewerId}` : "Unassigned"}</p>{assignment && <><p>by {assignment.assignedBy}</p><p>{new Date(assignment.assignedAt).toLocaleString()}</p></>}{(user?.role === "ADMIN" || user?.role === "FINANCE_MANAGER") && <select aria-label="Assign reviewer" className="mt-2 rounded-lg bg-panel border border-panel-border px-2 py-1" value={assignment?.reviewerId ?? ""} onChange={(event) => void assign(event.target.value)} disabled={loading}><option value="">Assign reviewer...</option>{users.filter(({ role }) => role !== "AUDITOR").map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.displayName}</option>)}</select>}</div></div>
      <div className="grid md:grid-cols-3 gap-4">{[["Source File", transaction.sourceFile], ["Source Sheet", transaction.sourceSheet ?? "-"], ["Source Row", transaction.sourceRow]].map(([label, value]) => <div className="card p-5" key={label}><p className="text-xs uppercase text-text-muted">{label}</p><p className="mt-2 font-bold">{value}</p></div>)}</div>
      <div className="grid lg:grid-cols-2 gap-6"><div className="card p-6"><h2 className="font-bold text-lg">Policy evidence</h2>{failedRules.length === 0 ? <p className="mt-4 text-text-secondary">No failed policy rules.</p> : <ul className="mt-4 space-y-3">{failedRules.map((rule) => <li key={rule.ruleId} className="border border-panel-border rounded-lg p-4"><p className="font-bold">{rule.ruleName}</p><p className="text-sm text-text-secondary mt-1">{rule.explanation}</p></li>)}</ul>}</div>
        <div className="card p-6"><h2 className="font-bold text-lg">Duplicate evidence</h2>{duplicateMatches.length === 0 ? <p className="mt-4 text-text-secondary">No duplicate evidence.</p> : <div className="mt-4"><p className="font-bold">{duplicateMatches[0].matchType} match with {duplicateMatches[0].matchedTransactionId}</p><ul className="mt-2 text-sm text-text-secondary">{duplicateMatches[0].evidence.map((evidence) => <li key={evidence}>• {evidence}</li>)}</ul>{matchedTransaction && <p className="mt-4 text-sm">Matched: {matchedTransaction.vendorName} · {matchedTransaction.invoiceNumber}</p>}</div>}</div></div>
      <div className="card p-6"><h2 className="font-bold text-lg">Reviewer decision</h2>{review && <p className="mt-2 text-sm text-text-secondary">Last action: {review.action} by {review.reviewerName}</p>}<textarea aria-label="Review note" className="mt-4 w-full rounded-xl bg-black/40 border border-panel-border p-4" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Audit note" /><div className="mt-4 flex flex-wrap gap-3"><button className="btn-primary" disabled={loading} onClick={() => void submit("APPROVE")}>Approve (A)</button><button className="btn-secondary" disabled={loading} onClick={() => void submit("REJECT")}>Reject (R)</button>{duplicateMatches.length > 0 && <button className="btn-secondary" disabled={loading} onClick={() => void submit("MARK_NOT_DUPLICATE")}>Not Duplicate (N)</button>}</div>{message && <p aria-live="polite" className="mt-4 text-sm text-text-secondary">{message}</p>}<details className="mt-4 text-sm text-text-muted"><summary>Keyboard shortcuts</summary><p className="mt-2">A approve · R reject · N mark not duplicate · J/↓ next · K/↑ previous. Shortcuts are disabled while typing.</p></details></div>
      <div className="card p-6"><h2 className="font-bold text-lg">Audit history</h2><ol className="mt-4 space-y-3">{auditEvents.map((event) => <li key={event.id} className="text-sm"><span className="font-bold">{event.action}</span> <span className="text-text-muted">{new Date(event.timestamp).toLocaleString()} · {event.actorId ?? "SYSTEM"}</span>{event.note && <p className="text-text-secondary">{event.note}</p>}</li>)}</ol></div>
    </div>
  );
}

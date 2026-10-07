"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MetricCard } from "./MetricCard";
import { StatusBadge } from "./StatusBadge";
import type { BatchHistoryItem, ExceptionPage } from "@/server/platform/types";

export function ServerDashboard() {
  const [data, setData] = useState<{ batch?: BatchHistoryItem; exceptions: ExceptionPage }>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch("/api/batches", { cache: "no-store" }),
      fetch("/api/exceptions?page=1&pageSize=5&sortBy=risk&sortDirection=desc", { cache: "no-store" }),
    ]).then(async ([batchesResponse, exceptionsResponse]) => {
      if (!batchesResponse.ok || !exceptionsResponse.ok) throw new Error("Dashboard data could not be loaded.");
      const batches = await batchesResponse.json() as { items: BatchHistoryItem[] };
      const exceptions = await exceptionsResponse.json() as ExceptionPage;
      if (active) setData({ batch: batches.items[0], exceptions });
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Dashboard data could not be loaded."); });
    return () => { active = false; };
  }, []);

  if (error) return <p role="alert" className="p-12 text-center text-status-danger-text">{error}</p>;
  if (!data) return <p className="p-12 text-center text-text-secondary">Loading dashboard...</p>;
  if (!data.batch) return <div className="card p-12 text-center"><h2 className="text-2xl font-bold">No analyzed batch yet</h2><p className="mt-3 text-text-secondary">Upload a Finance batch to begin shared review.</p><Link href="/upload" className="btn-primary inline-flex mt-6">Upload Invoice Batch</Link></div>;
  const { batch, exceptions } = data;
  const summary = batch.summary;
  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3"><div><h1 className="text-3xl font-extrabold">Dashboard</h1><p className="mt-2 text-text-secondary">Latest shared Finance batch.</p></div><div className="text-xs text-text-muted md:text-right"><p>Batch {batch.id}</p><p>Processed {batch.processedAt ? new Date(batch.processedAt).toLocaleString() : "Pending"}</p><p>Policy {batch.policyVersionId} · {batch.fileCount} file(s)</p></div></div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5"><MetricCard title="Total Processed" value={summary.totalProcessed} /><MetricCard title="Auto-cleared" value={summary.autoPassed} /><MetricCard title="Needs Review" value={summary.needsReview} /><MetricCard title="High Risk" value={summary.highRisk} /><MetricCard title="Duplicate Candidates" value={summary.duplicateCandidates} /><MetricCard title="Potential Exposure" value={summary.potentialExposure} isCurrency /></div>
      <div className="card p-6"><div className="flex justify-between"><div><p className="font-bold">Review progress</p><p className="text-sm text-text-secondary mt-1">{batch.reviewProgress.reviewed} of {batch.reviewProgress.exceptions} exceptions reviewed · {batch.reviewProgress.remaining} remaining</p></div><p className="text-2xl font-bold">{batch.reviewProgress.percentage}%</p></div><div className="mt-4 h-2 rounded-full bg-panel-border overflow-hidden"><div className="h-full bg-brand-primary" style={{ width: `${batch.reviewProgress.percentage}%` }} /></div></div>
      <section><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Priority Exceptions</h2><Link href="/exceptions" className="text-brand-primary font-semibold">View all</Link></div><div className="card divide-y divide-panel-border">{exceptions.items.length === 0 ? <p className="p-8 text-center text-text-secondary">No exceptions require review.</p> : exceptions.items.map(({ transaction, decision }) => <Link key={transaction.id} href={`/exceptions/${transaction.id}`} className="p-5 flex items-center justify-between hover:bg-panel-hover"><div><p className="font-bold">{transaction.invoiceNumber ?? transaction.id}</p><p className="text-sm text-text-secondary">{transaction.vendorName ?? "Unknown vendor"} · {decision.headline}</p></div><StatusBadge status={decision.status} /></Link>)}</div></section>
    </div>
  );
}

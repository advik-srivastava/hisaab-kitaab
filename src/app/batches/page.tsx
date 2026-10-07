"use client";

import { useEffect, useState } from "react";
import { ServerModeNotice } from "@/components/ServerModeNotice";
import type { BatchHistoryItem } from "@/server/platform/types";
import { formatINR, formatIndianNumber } from "@/lib/formatting";

export default function BatchesPage() {
  const serverMode = process.env.NEXT_PUBLIC_APP_MODE === "SERVER";
  const [items, setItems] = useState<BatchHistoryItem[]>();
  useEffect(() => {
    if (!serverMode) return;
    void fetch("/api/batches", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Batch history could not be loaded.");
      return response.json() as Promise<{ items: BatchHistoryItem[] }>;
    }).then((body) => setItems(body.items)).catch(() => setItems([]));
  }, [serverMode]);
  if (!serverMode) return <ServerModeNotice feature="Batch History" />;
  if (!items) return <p className="text-text-secondary">Loading batches...</p>;
  return (
    <div className="space-y-8"><div><h1 className="text-3xl font-extrabold">Batch History</h1><p className="mt-2 text-text-secondary">Shared processing and review history.</p></div>
      <div className="card overflow-x-auto"><table className="min-w-full"><thead><tr>{["Batch", "Status", "Uploaded", "Files", "Processed", "Review", "High Risk", "Duplicates", "Exposure", "Policy", "Report"].map((title) => <th className="table-header" key={title}>{title}</th>)}</tr></thead>
        <tbody>{items.map((batch) => <tr key={batch.id}><td className="table-cell font-mono">{batch.id}</td><td className="table-cell">{batch.status}</td><td className="table-cell"><span className="block">{new Date(batch.uploadedAt).toLocaleString()}</span><span className="text-xs text-text-muted">by {batch.uploadedBy}</span></td><td className="table-cell">{formatIndianNumber(batch.fileCount)}</td><td className="table-cell">{formatIndianNumber(batch.summary.totalProcessed)}</td><td className="table-cell">{formatIndianNumber(batch.reviewProgress.reviewed)}/{formatIndianNumber(batch.reviewProgress.exceptions)} ({batch.reviewProgress.percentage}%)</td><td className="table-cell">{formatIndianNumber(batch.summary.highRisk)}</td><td className="table-cell">{formatIndianNumber(batch.summary.duplicateCandidates)}</td><td className="table-cell">{formatINR(batch.summary.potentialExposure)}</td><td className="table-cell">{batch.policyVersionId}</td><td className="table-cell"><a className="text-brand-primary" href={`/api/batches/${batch.id}/report`}>Download</a></td></tr>)}</tbody>
      </table>{items.length === 0 && <p className="p-8 text-center text-text-secondary">No server batches yet.</p>}</div>
    </div>
  );
}

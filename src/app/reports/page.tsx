"use client";

import { useEffect, useState } from "react";
import { ServerModeNotice } from "@/components/ServerModeNotice";
import type { AgingSummary, TrendPoint } from "@/server/platform/types";
import { formatINR, formatIndianNumber } from "@/lib/formatting";

export default function ReportsPage() {
  const serverMode = process.env.NEXT_PUBLIC_APP_MODE === "SERVER";
  const [data, setData] = useState<{ trends: TrendPoint[]; aging: AgingSummary; insufficientHistory: boolean }>();
  useEffect(() => {
    if (!serverMode) return;
    void fetch("/api/reports", { cache: "no-store" }).then((response) => response.json()).then(setData).catch(() => setData({ trends: [], aging: { buckets: { LT_1_DAY: 0, ONE_TO_THREE_DAYS: 0, FOUR_TO_SEVEN_DAYS: 0, SEVEN_PLUS_DAYS: 0 } }, insufficientHistory: true }));
  }, [serverMode]);
  if (!serverMode) return <ServerModeNotice feature="Historical Reports" />;
  if (!data) return <p className="text-text-secondary">Loading reports...</p>;
  return (
    <div className="space-y-8"><div className="flex justify-between"><div><h1 className="text-3xl font-extrabold">Reports</h1><p className="mt-2 text-text-secondary">Real historical batch trends and exception aging.</p></div><a className="btn-secondary" href="/api/exports/audit">Export Audit</a></div>
      {data.insufficientHistory && <div className="card p-6 text-text-secondary">At least two processed batches are required for a meaningful trend.</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Object.entries(data.aging.buckets).map(([bucket, count]) => <div className="card p-5" key={bucket}><p className="text-xs text-text-muted uppercase">{bucket.replaceAll("_", " ")}</p><p className="text-2xl font-bold mt-2">{formatIndianNumber(count)}</p></div>)}</div>
      {data.aging.oldestUnresolved && <div className="card p-5"><p className="text-xs text-text-muted uppercase">Oldest unresolved</p><p className="font-bold mt-2">{data.aging.oldestUnresolved.transactionId} · {data.aging.oldestUnresolved.ageDays} days</p><p className="text-sm text-text-secondary mt-1">{data.aging.oldestUnresolved.status} · {data.aging.oldestUnresolved.assignedReviewerId ?? "Unassigned"}</p></div>}
      <div className="card overflow-x-auto"><table className="min-w-full"><thead><tr>{["Batch", "Processed", "Auto-clear", "Review", "High Risk", "Duplicates", "Exposure"].map((title) => <th key={title} className="table-header">{title}</th>)}</tr></thead><tbody>{data.trends.map((trend) => <tr key={trend.batchId}><td className="table-cell">{trend.batchId}</td><td className="table-cell">{formatIndianNumber(trend.transactionsProcessed)}</td><td className="table-cell">{(trend.autoClearRate * 100).toFixed(1)}%</td><td className="table-cell">{formatIndianNumber(trend.reviewVolume)}</td><td className="table-cell">{formatIndianNumber(trend.highRiskVolume)}</td><td className="table-cell">{formatIndianNumber(trend.duplicateCandidates)}</td><td className="table-cell">{formatINR(trend.potentialExposure)}</td></tr>)}</tbody></table></div>
    </div>
  );
}

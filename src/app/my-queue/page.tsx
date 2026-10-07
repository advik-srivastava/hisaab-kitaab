"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ServerModeNotice } from "@/components/ServerModeNotice";
import { StatusBadge } from "@/components/StatusBadge";
import type { ExceptionPage } from "@/server/platform/types";

export default function MyQueuePage() {
  const serverMode = process.env.NEXT_PUBLIC_APP_MODE === "SERVER";
  const [queues, setQueues] = useState<{ remaining: ExceptionPage; reviewed: ExceptionPage }>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!serverMode) return;
    void Promise.all([
      fetch("/api/exceptions?assignedReviewerId=me&reviewStatus=UNREVIEWED", { cache: "no-store" }),
      fetch("/api/exceptions?assignedReviewerId=me&reviewStatus=REVIEWED&pageSize=1", { cache: "no-store" }),
    ])
      .then(async ([remainingResponse, reviewedResponse]) => {
        if (!remainingResponse.ok || !reviewedResponse.ok) throw new Error("My Queue could not be loaded.");
        return {
          remaining: await remainingResponse.json() as ExceptionPage,
          reviewed: await reviewedResponse.json() as ExceptionPage,
        };
      })
      .then(setQueues)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "My Queue could not be loaded."));
  }, [serverMode]);

  if (!serverMode) return <ServerModeNotice feature="My Queue" />;
  if (error) return <p role="alert" className="text-red-500">{error}</p>;
  if (!queues) return <p className="text-text-secondary">Loading My Queue...</p>;
  const { remaining, reviewed } = queues;
  return (
    <div className="space-y-8">
      <div><h1 className="text-3xl font-extrabold">My Queue</h1><p className="mt-2 text-text-secondary">Exceptions assigned to you.</p></div>
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5"><p className="text-xs uppercase text-text-muted">Assigned</p><p className="text-2xl font-bold mt-2">{remaining.totalItems + reviewed.totalItems}</p></div>
        <div className="card p-5"><p className="text-xs uppercase text-text-muted">Reviewed</p><p className="text-2xl font-bold mt-2">{reviewed.totalItems}</p></div>
        <div className="card p-5"><p className="text-xs uppercase text-text-muted">Remaining</p><p className="text-2xl font-bold mt-2">{remaining.totalItems}</p></div>
      </div>
      <div className="card divide-y divide-panel-border">
        {remaining.items.length === 0 ? <p className="p-8 text-text-secondary">No assigned exceptions remain.</p> : remaining.items.map(({ transaction, decision }) => (
          <Link key={transaction.id} href={`/exceptions/${transaction.id}`} className="p-5 flex items-center justify-between hover:bg-surface-hover">
            <div><p className="font-bold">{transaction.vendorName ?? "Unknown vendor"}</p><p className="text-sm text-text-secondary">{transaction.invoiceNumber ?? transaction.id}</p></div>
            <StatusBadge status={decision.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}

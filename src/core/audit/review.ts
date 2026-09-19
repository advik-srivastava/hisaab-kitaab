import type { AuditEvent } from "../../types/audit";
import {
  loadState,
  saveState,
  type ReviewAction,
  type StorageLike,
  type StoredReviewAction,
} from "../../lib/storage";
import { createAuditEvent } from "./audit";

export interface ApplyReviewActionInput {
  transactionId: string;
  action: ReviewAction;
  reviewer: string;
  note?: string;
}

export interface ReviewRuntimeOptions {
  storage?: StorageLike;
  now?: () => Date;
}

export interface ApplyReviewActionResult {
  reviewAction: StoredReviewAction;
  auditEvent: AuditEvent;
}

export function applyReviewAction(
  input: ApplyReviewActionInput,
  options: ReviewRuntimeOptions = {},
): ApplyReviewActionResult | undefined {
  const state = loadState(options.storage);
  const batch = state.currentBatch;
  if (!batch || !batch.transactions.some(({ id }) => id === input.transactionId)) {
    return undefined;
  }

  const systemStatus = batch.decisions[input.transactionId]?.status ?? null;
  const now = options.now ?? (() => new Date());
  const auditEvent = createAuditEvent(
    state,
    {
      transactionId: input.transactionId,
      batchId: batch.batchId,
      actorType: "USER",
      actorId: input.reviewer,
      action: input.action,
      oldStatus: systemStatus,
      newStatus: systemStatus,
      note: input.note ?? null,
    },
    now,
  );
  const reviewAction: StoredReviewAction = {
    action: input.action,
    reviewer: input.reviewer,
    note: input.note ?? null,
    timestamp: auditEvent.timestamp,
    auditEventId: auditEvent.id,
  };

  batch.auditEvents.push(auditEvent);
  (batch.reviewActions[input.transactionId] ??= []).push(reviewAction);

  return saveState(state, options.storage)
    ? { reviewAction, auditEvent }
    : undefined;
}

import type { AuditEvent } from "../../types/audit";
import {
  getBrowserPersistence,
  loadState,
  saveState,
  type ReviewAction,
  type PersistenceAdapter,
  type StorageWriteResult,
  type StorageLike,
  type StoredReviewAction,
} from "../../lib/storage";
import { createAuditEvent, createAuditEventAtSequence } from "./audit";

export interface ApplyReviewActionInput {
  transactionId: string;
  action: ReviewAction;
  reviewer: string;
  note?: string;
}

export interface ReviewRuntimeOptions {
  storage?: StorageLike;
  persistence?: PersistenceAdapter;
  now?: () => Date;
}

export interface ApplyReviewActionResult {
  reviewAction: StoredReviewAction;
  auditEvent: AuditEvent;
}

export interface ApplyReviewActionAsyncResult extends ApplyReviewActionResult {
  persistence: StorageWriteResult;
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

export async function applyReviewActionAsync(
  input: ApplyReviewActionInput,
  options: ReviewRuntimeOptions = {},
): Promise<ApplyReviewActionAsyncResult | undefined> {
  if (options.storage && !options.persistence) {
    const result = applyReviewAction(input, options);
    return result ? {
      ...result,
      persistence: { success: true, serializedBytes: 0, serializationMs: 0, writeMs: 0 },
    } : undefined;
  }
  const adapter = options.persistence ?? getBrowserPersistence();
  if (!adapter) return undefined;
  try {
    const transaction = await adapter.getTransaction(input.transactionId);
    if (!transaction) return undefined;
    const [decision, count] = await Promise.all([
      adapter.getDecision(input.transactionId),
      adapter.getAuditEventCount(transaction.batchId),
    ]);
    const auditEvent = createAuditEventAtSequence(
      count + 1,
      {
        transactionId: input.transactionId,
        batchId: transaction.batchId,
        actorType: "USER",
        actorId: input.reviewer,
        action: input.action,
        oldStatus: decision?.status ?? null,
        newStatus: decision?.status ?? null,
        note: input.note ?? null,
      },
      options.now ?? (() => new Date()),
    );
    const reviewAction: StoredReviewAction = {
      action: input.action,
      reviewer: input.reviewer,
      note: input.note ?? null,
      timestamp: auditEvent.timestamp,
      auditEventId: auditEvent.id,
    };
    const persistence = await adapter.saveReviewAction(
      transaction.batchId,
      input.transactionId,
      reviewAction,
      auditEvent,
    );
    return { reviewAction, auditEvent, persistence };
  } catch {
    return undefined;
  }
}

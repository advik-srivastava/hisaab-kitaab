import type { AuditEvent } from "../../types/audit";
import type { Decision } from "../../types/decisions";
import type { DuplicateMatch } from "../../types/duplicates";
import type { RuleResult } from "../../types/rules";
import type { Transaction } from "../../types/transaction";
import { loadState, saveState } from "./storage";
import type {
  AnalyzedBatchInput,
  PersistedState,
  StorageLike,
  StoredReviewAction,
} from "./types";

export function saveAnalyzedBatch(
  input: AnalyzedBatchInput,
  storage?: StorageLike,
): PersistedState {
  const state: PersistedState = {
    version: 1,
    currentBatch: {
      ...input,
      auditEvents: input.auditEvents ?? [],
      reviewActions: {},
    },
  };
  saveState(state, storage);
  return state;
}

export function getTransaction(
  transactionId: string,
  storage?: StorageLike,
): Transaction | undefined {
  return loadState(storage).currentBatch?.transactions.find(
    ({ id }) => id === transactionId,
  );
}

export function getDecision(
  transactionId: string,
  storage?: StorageLike,
): Decision | undefined {
  return loadState(storage).currentBatch?.decisions[transactionId];
}

export function getRuleResults(
  transactionId: string,
  storage?: StorageLike,
): RuleResult[] {
  return loadState(storage).currentBatch?.ruleResults[transactionId] ?? [];
}

export function getDuplicateMatches(
  transactionId: string,
  storage?: StorageLike,
): DuplicateMatch[] {
  return loadState(storage).currentBatch?.duplicateMatches[transactionId] ?? [];
}

export function getAuditEvents(
  transactionId: string,
  storage?: StorageLike,
): AuditEvent[] {
  return (
    loadState(storage).currentBatch?.auditEvents.filter(
      (event) => event.transactionId === transactionId,
    ) ?? []
  );
}

export function getReviewActions(
  transactionId: string,
  storage?: StorageLike,
): StoredReviewAction[] {
  return loadState(storage).currentBatch?.reviewActions[transactionId] ?? [];
}

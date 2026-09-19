import type { AuditEvent, ActorType } from "../../types/audit";
import type { DecisionStatus } from "../../types/decisions";
import {
  loadState,
  saveState,
  type PersistedState,
  type StorageLike,
} from "../../lib/storage";

export interface AuditRuntimeOptions {
  storage?: StorageLike;
  now?: () => Date;
}

export interface AppendAuditEventInput {
  transactionId: string;
  batchId: string;
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  oldStatus?: DecisionStatus | null;
  newStatus?: DecisionStatus | null;
  note?: string | null;
}

function createAuditEvent(
  state: PersistedState,
  input: AppendAuditEventInput,
  now: () => Date,
): AuditEvent {
  const sequence = (state.currentBatch?.auditEvents.length ?? 0) + 1;
  const timestamp = now().toISOString();
  return {
    id: `audit-${sequence}-${timestamp}`,
    transactionId: input.transactionId,
    batchId: input.batchId,
    timestamp,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    action: input.action,
    oldStatus: input.oldStatus ?? null,
    newStatus: input.newStatus ?? null,
    note: input.note ?? null,
  };
}

export function appendAuditEvent(
  input: AppendAuditEventInput,
  options: AuditRuntimeOptions = {},
): AuditEvent | undefined {
  const state = loadState(options.storage);
  if (!state.currentBatch || state.currentBatch.batchId !== input.batchId) {
    return undefined;
  }

  const event = createAuditEvent(state, input, options.now ?? (() => new Date()));
  state.currentBatch.auditEvents.push(event);
  return saveState(state, options.storage) ? event : undefined;
}

export { createAuditEvent };

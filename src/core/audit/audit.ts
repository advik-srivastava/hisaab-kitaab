import type { AuditEvent, ActorType } from "../../types/audit";
import type { DecisionStatus } from "../../types/decisions";
import {
  loadState,
  saveStateWithResult,
  type PersistedState,
  type StorageLike,
  type StorageWriteResult,
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

export interface AppendAuditEventsResult {
  events: AuditEvent[];
  persistence: StorageWriteResult;
}

function invalidBatchResult(): AppendAuditEventsResult {
  return {
    events: [],
    persistence: {
      success: false,
      serializedBytes: 0,
      serializationMs: 0,
      writeMs: 0,
      error: {
        code: "INVALID_STATE",
        message: "The audit batch does not match persisted state.",
      },
    },
  };
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
  const result = appendAuditEvents([input], options);
  return result.persistence.success ? result.events[0] : undefined;
}

export function appendAuditEvents(
  inputs: readonly AppendAuditEventInput[],
  options: AuditRuntimeOptions = {},
): AppendAuditEventsResult {
  const state = loadState(options.storage);
  if (
    !state.currentBatch ||
    inputs.some(({ batchId }) => batchId !== state.currentBatch?.batchId)
  ) {
    return invalidBatchResult();
  }

  const now = options.now ?? (() => new Date());
  const events = inputs.map((input) => {
    const event = createAuditEvent(state, input, now);
    state.currentBatch!.auditEvents.push(event);
    return event;
  });

  return {
    events,
    persistence: saveStateWithResult(state, options.storage),
  };
}

export { createAuditEvent };

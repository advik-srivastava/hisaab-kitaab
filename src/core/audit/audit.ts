import type { AuditEvent, ActorType } from "../../types/audit";
import type { DecisionStatus } from "../../types/decisions";
import {
  getBrowserPersistence,
  loadState,
  saveStateWithResult,
  type PersistedState,
  type PersistenceAdapter,
  type StorageLike,
  type StorageWriteResult,
} from "../../lib/storage";

export interface AuditRuntimeOptions {
  storage?: StorageLike;
  persistence?: PersistenceAdapter;
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

let auditIdSequence = 0;

function auditIdSuffix(): string {
  auditIdSequence += 1;
  const random = globalThis.crypto?.randomUUID?.();
  return random ?? `${Date.now()}-${auditIdSequence}`;
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
  return createAuditEventAtSequence(sequence, input, now);
}

export function createAuditEventAtSequence(
  sequence: number,
  input: AppendAuditEventInput,
  now: () => Date,
): AuditEvent {
  const timestamp = now().toISOString();
  return {
    id: `audit-${sequence}-${timestamp}-${auditIdSuffix()}`,
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

export async function appendAuditEventsAsync(
  inputs: readonly AppendAuditEventInput[],
  options: AuditRuntimeOptions = {},
): Promise<AppendAuditEventsResult> {
  if (options.storage && !options.persistence) return appendAuditEvents(inputs, options);
  const adapter = options.persistence ?? getBrowserPersistence();
  if (!adapter) return invalidBatchResult();
  try {
    const metadata = await adapter.getCurrentBatchMetadata();
    if (!metadata || inputs.some(({ batchId }) => batchId !== metadata.batchId)) {
      return invalidBatchResult();
    }
    const start = (await adapter.getAuditEventCount(metadata.batchId)) + 1;
    const now = options.now ?? (() => new Date());
    const events = inputs.map((input, index) =>
      createAuditEventAtSequence(start + index, input, now),
    );
    return { events, persistence: await adapter.appendAuditEvents(metadata.batchId, events) };
  } catch {
    return invalidBatchResult();
  }
}

export { createAuditEvent };

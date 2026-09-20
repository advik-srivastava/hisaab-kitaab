import { persistedStateSchema } from "./schema";
import { getBrowserPersistence } from "./indexedDb";
import {
  BATCH_MARKER_KEY,
  STORAGE_KEY,
  STORAGE_VERSION,
  type PersistedState,
  type PersistenceAdapter,
  type StorageLike,
  type StorageWriteErrorCode,
  type StorageWriteResult,
} from "./types";

export function createInitialState(): PersistedState {
  return { version: STORAGE_VERSION, currentBatch: null };
}

function browserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function resolveStorage(storage?: StorageLike): StorageLike | undefined {
  return storage ?? browserStorage();
}

export function loadState(storage?: StorageLike): PersistedState {
  const target = resolveStorage(storage);
  if (!target) {
    return createInitialState();
  }

  try {
    if (!storage) {
      target.removeItem(STORAGE_KEY);
      const batchId = target.getItem(BATCH_MARKER_KEY);
      if (!batchId) return createInitialState();
      return {
        version: STORAGE_VERSION,
        currentBatch: {
          batchId,
          createdAt: "",
          transactions: [],
          ruleResults: {},
          duplicateMatches: {},
          decisions: {},
          auditEvents: [],
          reviewActions: {},
        },
      };
    }

    const serialized = target.getItem(STORAGE_KEY);
    if (!serialized) {
      return createInitialState();
    }

    const result = persistedStateSchema.safeParse(JSON.parse(serialized));
    return result.success ? result.data : createInitialState();
  } catch {
    return createInitialState();
  }
}

function elapsed(startedAt: number): number {
  return performance.now() - startedAt;
}

function failedWrite(
  code: StorageWriteErrorCode,
  message: string,
  serializedBytes = 0,
  serializationMs = 0,
): StorageWriteResult {
  return {
    success: false,
    serializedBytes,
    serializationMs,
    writeMs: 0,
    error: { code, message },
  };
}

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: string; code?: number };
  return (
    candidate.name === "QuotaExceededError" ||
    candidate.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    candidate.code === 22 ||
    candidate.code === 1014
  );
}

export function serializedSizeBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function saveStateWithResult(
  state: PersistedState,
  storage?: StorageLike,
): StorageWriteResult {
  const target = resolveStorage(storage);
  if (!target) {
    return failedWrite(
      "STORAGE_UNAVAILABLE",
      "Browser storage is unavailable.",
    );
  }

  const validated = persistedStateSchema.safeParse(state);
  if (!validated.success) {
    return failedWrite("INVALID_STATE", "Persisted state is invalid.");
  }

  let serialized: string;
  const serializationStarted = performance.now();
  try {
    serialized = JSON.stringify(validated.data);
  } catch {
    return failedWrite(
      "SERIALIZATION_FAILED",
      "Persisted state could not be serialized.",
      0,
      elapsed(serializationStarted),
    );
  }

  const serializationMs = elapsed(serializationStarted);
  const serializedBytes = new TextEncoder().encode(serialized).byteLength;
  const writeStarted = performance.now();
  try {
    target.setItem(STORAGE_KEY, serialized);
    return {
      success: true,
      serializedBytes,
      serializationMs,
      writeMs: elapsed(writeStarted),
    };
  } catch (error) {
    const code = isQuotaError(error) ? "QUOTA_EXCEEDED" : "WRITE_FAILED";
    return {
      success: false,
      serializedBytes,
      serializationMs,
      writeMs: elapsed(writeStarted),
      error: {
        code,
        message:
          code === "QUOTA_EXCEEDED"
            ? "Browser storage quota was exceeded."
            : "Browser storage could not be written.",
      },
    };
  }
}

export function saveState(
  state: PersistedState,
  storage?: StorageLike,
): boolean {
  return saveStateWithResult(state, storage).success;
}

export function clearState(storage?: StorageLike): void {
  const target = resolveStorage(storage);
  if (!target) return;

  try {
    target.removeItem(STORAGE_KEY);
    target.removeItem(BATCH_MARKER_KEY);
  } catch {
    // Storage can be unavailable even when window exists.
  }
}

export function resetDemoData(storage?: StorageLike): PersistedState {
  clearState(storage);
  return createInitialState();
}

export async function loadStateAsync(
  persistence?: PersistenceAdapter,
): Promise<PersistedState> {
  const adapter = persistence ?? getBrowserPersistence();
  if (!adapter) return createInitialState();
  try {
    return {
      version: STORAGE_VERSION,
      currentBatch: (await adapter.getCurrentBatch()) ?? null,
    };
  } catch {
    return createInitialState();
  }
}

export async function resetDemoDataAsync(
  persistence?: PersistenceAdapter,
): Promise<PersistedState> {
  const adapter = persistence ?? getBrowserPersistence();
  try {
    await adapter?.clear();
  } catch {
    // Reset remains safe when browser storage is unavailable.
  }
  clearState();
  return createInitialState();
}

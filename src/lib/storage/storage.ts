import { persistedStateSchema } from "./schema";
import {
  STORAGE_KEY,
  STORAGE_VERSION,
  type PersistedState,
  type StorageLike,
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

export function saveState(
  state: PersistedState,
  storage?: StorageLike,
): boolean {
  const target = resolveStorage(storage);
  if (!target) {
    return false;
  }

  const validated = persistedStateSchema.safeParse(state);
  if (!validated.success) {
    return false;
  }

  try {
    target.setItem(STORAGE_KEY, JSON.stringify(validated.data));
    return true;
  } catch {
    return false;
  }
}

export function clearState(storage?: StorageLike): void {
  const target = resolveStorage(storage);
  if (!target) return;

  try {
    target.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable even when window exists.
  }
}

export function resetDemoData(storage?: StorageLike): PersistedState {
  clearState(storage);
  return createInitialState();
}

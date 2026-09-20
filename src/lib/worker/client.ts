import {
  analyzeBatch,
  persistAnalyzedBatch,
  type ProcessBatchOptions,
  type ProcessBatchResult,
  type ProcessingProgress,
} from "../../core/pipeline";
import {
  isBatchWorkerResponse,
  type BatchWorkerResponse,
  type ProcessBatchWorkerRequest,
} from "./protocol";

export interface WorkerLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: ProcessBatchWorkerRequest): void;
  terminate(): void;
}

export interface ProcessBatchInWorkerOptions extends ProcessBatchOptions {
  workerFactory?: () => WorkerLike;
}

export class WorkerProcessingError extends Error {
  constructor(
    readonly code: "WORKER_FAILED" | "INVALID_RESPONSE" | "ANALYSIS_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "WorkerProcessingError";
  }
}

let requestSequence = 0;

function requestId(): string {
  requestSequence += 1;
  return `batch-worker-${Date.now()}-${requestSequence}`;
}

function referenceDateValue(value: Date | string | undefined): string | undefined {
  return value instanceof Date ? value.toISOString() : value;
}

function createBrowserWorker(): WorkerLike {
  return new Worker(new URL("../../workers/batch.worker.ts", import.meta.url), {
    type: "module",
  });
}

async function processWithoutWorker(
  files: readonly File[],
  options: ProcessBatchInWorkerOptions,
  onProgress?: (progress: ProcessingProgress) => void,
): Promise<ProcessBatchResult> {
  const analysis = await analyzeBatch(files, { ...options, onProgress });
  onProgress?.({ stage: "SAVING_RESULTS" });
  const result = await persistAnalyzedBatch(analysis, options);
  onProgress?.({ stage: "COMPLETE" });
  return result;
}

function runWorkerAnalysis(
  worker: WorkerLike,
  request: ProcessBatchWorkerRequest,
  onProgress?: (progress: ProcessingProgress) => void,
): Promise<Awaited<ReturnType<typeof analyzeBatch>>> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      callback();
    };
    worker.onmessage = (event) => {
      const response = event.data;
      if (!isBatchWorkerResponse(response) || response.requestId !== request.requestId) {
        finish(() => reject(new WorkerProcessingError(
          "INVALID_RESPONSE",
          "The batch worker returned an invalid response.",
        )));
        return;
      }
      if (response.type === "PROCESS_PROGRESS") {
        onProgress?.({
          stage: response.stage,
          processed: response.processed,
          total: response.total,
        });
        return;
      }
      if (response.type === "PROCESS_ERROR") {
        finish(() => reject(new WorkerProcessingError(
          response.error.code,
          response.error.message,
        )));
        return;
      }
      finish(() => resolve(response.result));
    };
    worker.onerror = (event) => finish(() => reject(new WorkerProcessingError(
      "WORKER_FAILED",
      event.message || "The batch worker failed unexpectedly.",
    )));
    worker.onmessageerror = () => finish(() => reject(new WorkerProcessingError(
      "INVALID_RESPONSE",
      "The batch worker response could not be decoded.",
    )));
    try {
      worker.postMessage(request);
    } catch (error) {
      finish(() => reject(new WorkerProcessingError(
        "WORKER_FAILED",
        error instanceof Error ? error.message : "The batch worker could not be started.",
      )));
    }
  });
}

export async function processBatchInWorker(
  files: readonly File[],
  options: ProcessBatchInWorkerOptions = {},
  onProgress?: (progress: ProcessingProgress) => void,
): Promise<ProcessBatchResult> {
  const factory = options.workerFactory
    ?? (typeof Worker === "undefined" ? undefined : createBrowserWorker);
  if (!factory) return processWithoutWorker(files, options, onProgress);

  let worker: WorkerLike;
  try {
    worker = factory();
  } catch {
    return processWithoutWorker(files, options, onProgress);
  }

  const request: ProcessBatchWorkerRequest = {
    type: "PROCESS_BATCH",
    requestId: requestId(),
    files: [...files],
    options: {
      referenceDate: referenceDateValue(options.referenceDate),
      nowIso: options.now?.().toISOString(),
    },
  };
  const analysis = await runWorkerAnalysis(worker, request, onProgress);
  onProgress?.({ stage: "SAVING_RESULTS" });
  const result = await persistAnalyzedBatch(analysis, options);
  onProgress?.({ stage: "COMPLETE" });
  return result;
}

export type { BatchWorkerResponse, ProcessBatchWorkerRequest };

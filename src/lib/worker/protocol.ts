import type {
  BatchAnalysisResult,
  ProcessingProgress,
} from "../../core/pipeline";
import type { FinancePolicy } from "../../types/policies";

export interface WorkerAnalysisOptions {
  referenceDate?: string;
  nowIso?: string;
  policy: FinancePolicy;
}

export interface ProcessBatchWorkerRequest {
  type: "PROCESS_BATCH";
  requestId: string;
  files: File[];
  options: WorkerAnalysisOptions;
}

export interface ProcessCompleteWorkerResponse {
  type: "PROCESS_COMPLETE";
  requestId: string;
  result: BatchAnalysisResult;
}

export interface ProcessProgressWorkerResponse extends ProcessingProgress {
  type: "PROCESS_PROGRESS";
  requestId: string;
}

export interface ProcessErrorWorkerResponse {
  type: "PROCESS_ERROR";
  requestId: string;
  error: {
    code: "ACTIVE_POLICY_REQUIRED" | "ANALYSIS_FAILED";
    message: string;
  };
}

export type BatchWorkerResponse =
  | ProcessCompleteWorkerResponse
  | ProcessProgressWorkerResponse
  | ProcessErrorWorkerResponse;

const progressStages = new Set([
  "READING_FILES",
  "NORMALIZING",
  "EVALUATING_RULES",
  "CHECKING_DUPLICATES",
  "MAKING_DECISIONS",
  "SAVING_RESULTS",
  "COMPLETE",
]);

export function isBatchWorkerResponse(value: unknown): value is BatchWorkerResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    type?: unknown;
    requestId?: unknown;
    result?: unknown;
    stage?: unknown;
    error?: unknown;
  };
  if (typeof candidate.requestId !== "string") return false;
  if (candidate.type === "PROCESS_PROGRESS") {
    return typeof candidate.stage === "string" && progressStages.has(candidate.stage);
  }
  if (candidate.type === "PROCESS_ERROR") {
    const error = candidate.error as { code?: unknown; message?: unknown } | undefined;
    return (error?.code === "ACTIVE_POLICY_REQUIRED" || error?.code === "ANALYSIS_FAILED")
      && typeof error.message === "string";
  }
  if (candidate.type === "PROCESS_COMPLETE") {
    const result = candidate.result as Partial<BatchAnalysisResult> | undefined;
    return typeof result?.batchId === "string"
      && Array.isArray(result.transactions)
      && typeof result.ruleResults === "object"
      && typeof result.decisions === "object"
      && typeof result.batchSummary === "object";
  }
  return false;
}

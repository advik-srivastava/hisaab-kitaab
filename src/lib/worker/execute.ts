import { analyzeBatch } from "../../core/pipeline";
import type {
  BatchWorkerResponse,
  ProcessBatchWorkerRequest,
} from "./protocol";

export async function executeProcessBatchRequest(
  request: ProcessBatchWorkerRequest,
  emit: (response: BatchWorkerResponse) => void,
): Promise<void> {
  try {
    const nowIso = request.options.nowIso;
    const result = await analyzeBatch(request.files, {
      referenceDate: request.options.referenceDate,
      now: nowIso
        ? () => new Date(nowIso)
        : undefined,
      onProgress: (progress) => emit({
        type: "PROCESS_PROGRESS",
        requestId: request.requestId,
        ...progress,
      }),
    });
    emit({ type: "PROCESS_COMPLETE", requestId: request.requestId, result });
  } catch (error) {
    emit({
      type: "PROCESS_ERROR",
      requestId: request.requestId,
      error: {
        code: "ANALYSIS_FAILED",
        message: error instanceof Error ? error.message : "Batch analysis failed.",
      },
    });
  }
}

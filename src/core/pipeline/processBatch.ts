import { analyzeBatch } from "./analyzeBatch";
import { persistAnalyzedBatch } from "./persistAnalyzedBatch";
import type { ProcessBatchOptions, ProcessBatchResult } from "./types";

export async function processBatch(
  files: readonly File[],
  options: ProcessBatchOptions = {},
): Promise<ProcessBatchResult> {
  const analysis = await analyzeBatch(files, options);
  return persistAnalyzedBatch(analysis, options);
}

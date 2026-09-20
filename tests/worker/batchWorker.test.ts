import { File as NodeFile } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  analyzeBatch,
  type BatchAnalysisResult,
  type ProcessingStage,
} from "../../src/core/pipeline";
import {
  executeProcessBatchRequest,
  processBatchInWorker,
  WorkerProcessingError,
  type BatchWorkerResponse,
  type ProcessBatchWorkerRequest,
  type WorkerLike,
} from "../../src/lib/worker";
import { MemoryPersistence } from "../storage/memoryPersistence";

function csvFile(content: string, name = "transactions.csv"): File {
  const file = new NodeFile([content], name, { type: "text/csv" });
  Object.defineProperty(file, "webkitRelativePath", { value: "" });
  return file as unknown as File;
}

function generatedCsv(count: number): string {
  const rows = Array.from(
    { length: count },
    (_, index) => `Vendor ${index},INV-${index},2026-09-19,${100 + index},INR,Office,PO-${index}`,
  );
  return [
    "Vendor,Invoice,Invoice Date,Amount,Currency,Category,PO",
    ...rows,
  ].join("\n");
}

const workerOptions = {
  referenceDate: "2026-09-20",
  nowIso: "2026-09-20T12:00:00.000Z",
};

async function executeWorker(files: File[]): Promise<{
  result: BatchAnalysisResult;
  stages: ProcessingStage[];
}> {
  const responses: BatchWorkerResponse[] = [];
  await executeProcessBatchRequest(
    { type: "PROCESS_BATCH", requestId: "request-1", files, options: workerOptions },
    (response) => responses.push(response),
  );
  const complete = responses.find((response) => response.type === "PROCESS_COMPLETE");
  if (!complete || complete.type !== "PROCESS_COMPLETE") {
    throw new Error("Worker did not complete.");
  }
  return {
    result: complete.result,
    stages: responses.flatMap((response) =>
      response.type === "PROCESS_PROGRESS" ? [response.stage] : [],
    ),
  };
}

function semanticProfile(result: BatchAnalysisResult) {
  return {
    transactionCount: result.transactions.length,
    failureCounts: result.transactions.map(({ id }) =>
      result.ruleResults[id].filter(({ status }) => status === "FAIL").length),
    duplicateTypes: result.transactions.map(({ id }) =>
      result.duplicateMatches[id].map(({ matchType }) => matchType)),
    statuses: result.transactions.map(({ id }) => result.decisions[id].status),
    batchSummary: result.batchSummary,
  };
}

class InlineWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  terminated = false;

  postMessage(message: ProcessBatchWorkerRequest): void {
    void executeProcessBatchRequest(message, (response) => {
      this.onmessage?.({ data: response } as MessageEvent<unknown>);
    });
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe("batch analysis worker", () => {
  it("uses the typed worker protocol and persists only after worker analysis", async () => {
    const persistence = new MemoryPersistence();
    const worker = new InlineWorker();
    const stages: ProcessingStage[] = [];
    const result = await processBatchInWorker(
      [csvFile(`${generatedCsv(1)}`)],
      {
        referenceDate: "2026-09-20",
        now: () => new Date(workerOptions.nowIso),
        persistence,
        workerFactory: () => worker,
      },
      ({ stage }) => stages.push(stage),
    );

    expect(worker.terminated).toBe(true);
    expect(stages).toEqual(expect.arrayContaining([
      "READING_FILES",
      "EVALUATING_RULES",
      "CHECKING_DUPLICATES",
      "MAKING_DECISIONS",
      "SAVING_RESULTS",
      "COMPLETE",
    ]));
    expect(result.persistence.success).toBe(true);
    expect(persistence.transactions.size).toBe(1);
    expect(persistence.audits.some(({ action }) => action === "BATCH_PROCESSED")).toBe(true);
  });

  it("preserves partial success and controlled corrupt-file errors", async () => {
    const { result } = await executeWorker([
      csvFile(generatedCsv(1), "good.csv"),
      csvFile("not a workbook", "broken.xlsx"),
    ]);

    expect(result.transactions).toHaveLength(1);
    expect(result.filesProcessed).toBe(1);
    expect(result.fileErrors).toEqual([
      expect.objectContaining({ fileName: "broken.xlsx", code: "CORRUPT_XLSX" }),
    ]);
  });

  it.each([2_000, 10_000])(
    "matches direct Finance semantics for a generated %,i-row batch",
    async (count) => {
      const csv = generatedCsv(count);
      const direct = await analyzeBatch([csvFile(csv)], {
        referenceDate: workerOptions.referenceDate,
        now: () => new Date(workerOptions.nowIso),
      });
      const worker = await executeWorker([csvFile(csv)]);

      expect(semanticProfile(worker.result)).toEqual(semanticProfile(direct));
      expect(worker.result.transactions).toHaveLength(count);
    },
    30_000,
  );

  it("preserves the 16-row golden semantic profile", async () => {
    const clean = Array.from(
      { length: 12 },
      (_, index) => `Clean ${index},C-${index},2026-09-19,${200 + index},INR,Office,PO-${index}`,
    );
    const csv = [
      "Vendor,Invoice,Invoice Date,Amount,Currency,Category,PO",
      ...clean,
      "Meals Vendor,M-1,2026-09-19,2000.01,INR,Meals,PO-M",
      "Hotel Vendor,H-1,2026-09-19,10000.01,INR,Hotel,PO-H",
      "Duplicate Vendor,D-1,2026-09-19,100,INR,Office,PO-D1",
      "Duplicate Vendor,D-1,2026-09-19,100,INR,Office,PO-D2",
    ].join("\n");
    const direct = await analyzeBatch([csvFile(csv)], {
      referenceDate: workerOptions.referenceDate,
    });
    const worker = await executeWorker([csvFile(csv)]);

    expect(semanticProfile(worker.result)).toEqual(semanticProfile(direct));
    expect(worker.result.batchSummary).toMatchObject({
      totalProcessed: 16,
      autoPassed: 12,
      needsReview: 1,
      highRisk: 3,
      duplicateCandidates: 2,
    });
  });

  it("falls back to the same analysis path when worker construction fails", async () => {
    const persistence = new MemoryPersistence();
    const result = await processBatchInWorker([csvFile(generatedCsv(1))], {
      referenceDate: workerOptions.referenceDate,
      persistence,
      workerFactory: () => { throw new Error("Worker unavailable"); },
    });

    expect(result.transactions).toHaveLength(1);
    expect(result.persistence.success).toBe(true);
  });

  it("rejects malformed worker messages and terminates the worker", async () => {
    const worker = new InlineWorker();
    worker.postMessage = () => {
      worker.onmessage?.({ data: { bad: true } } as MessageEvent<unknown>);
    };

    await expect(processBatchInWorker([csvFile(generatedCsv(1))], {
      workerFactory: () => worker,
    })).rejects.toBeInstanceOf(WorkerProcessingError);
    expect(worker.terminated).toBe(true);
  });
});

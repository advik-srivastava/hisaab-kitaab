import { File as NodeFile } from "node:buffer";

import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { processBatch } from "../../src/core/pipeline";
import {
  getAuditEvents,
  getDecision,
  getDuplicateMatches,
  getRuleResults,
  getTransaction,
  loadState,
  type StorageLike,
} from "../../src/lib/storage";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function browserFile(
  content: Array<string | Uint8Array>,
  name: string,
  options?: FilePropertyBag,
): File {
  const file = new NodeFile(content, name, options);
  Object.defineProperty(file, "webkitRelativePath", { value: "" });
  return file as unknown as File;
}

function csvFile(content: string, name = "transactions.csv"): File {
  return browserFile([content], name, { type: "text/csv" });
}

function xlsxFile(
  sheets: Array<{ name: string; rows: unknown[][] }>,
  name = "transactions.xlsx",
): File {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(sheet.rows),
      sheet.name,
    );
  }
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return browserFile([bytes], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

const header = "Vendor,Invoice,Invoice Date,Amount,Currency,Category,PO";
const cleanRow = "Contoso,INV-1,2026-09-18,1000,INR,Office,PO-1";
const fixedOptions = {
  referenceDate: "2026-09-19",
  now: () => new Date("2026-09-19T12:00:00.000Z"),
};

async function processCsv(content: string, storage = new MemoryStorage()) {
  return processBatch([csvFile(content)], { ...fixedOptions, storage });
}

function decisions(result: Awaited<ReturnType<typeof processBatch>>) {
  return result.transactions.map(({ id }) => result.decisions[id]);
}

describe("end-to-end batch processing", () => {
  it("passes a valid CSV through the full pipeline", async () => {
    const result = await processCsv(`${header}\n${cleanRow}`);
    expect(result).toMatchObject({ filesProcessed: 1, rowsProcessed: 1 });
    expect(result.transactions).toHaveLength(1);
    expect(result.ruleResults[result.transactions[0].id]).toHaveLength(13);
    expect(result.decisions[result.transactions[0].id].status).toBe("AUTO_PASS");
  });

  it("passes a valid XLSX through the full pipeline", async () => {
    const storage = new MemoryStorage();
    const result = await processBatch([
      xlsxFile([
        {
          name: "Invoices",
          rows: [
            ["Vendor", "Invoice", "Invoice Date", "Amount", "Currency"],
            ["Contoso", "INV-1", "2026-09-18", 1000, "INR"],
          ],
        },
      ]),
    ], { ...fixedOptions, storage });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].sourceSheet).toBe("Invoices");
    expect(result.decisions[result.transactions[0].id].status).toBe("AUTO_PASS");
  });

  it("processes multiple files together", async () => {
    const result = await processBatch([
      csvFile(`${header}\n${cleanRow}`, "one.csv"),
      csvFile(`${header}\nFabrikam,FAB-1,2026-09-18,2000,INR,Office,PO-2`, "two.csv"),
    ], { ...fixedOptions, storage: new MemoryStorage() });
    expect(result).toMatchObject({ filesProcessed: 2, rowsProcessed: 2 });
    expect(result.transactions).toHaveLength(2);
  });

  it("returns partial success for one corrupt and one valid file", async () => {
    const result = await processBatch([
      browserFile(["not a workbook"], "broken.xlsx"),
      csvFile(`${header}\n${cleanRow}`, "good.csv"),
    ], { ...fixedOptions, storage: new MemoryStorage() });
    expect(result.transactions).toHaveLength(1);
    expect(result.fileErrors).toHaveLength(1);
    expect(result.fileErrors[0]).toMatchObject({
      fileName: "broken.xlsx",
      code: "CORRUPT_XLSX",
    });
  });

  it("classifies a clean transaction as AUTO_PASS", async () => {
    expect(decisions(await processCsv(`${header}\n${cleanRow}`))[0].status).toBe("AUTO_PASS");
  });

  it("classifies a medium policy violation as REVIEW", async () => {
    const result = await processCsv(
      `${header}\nContoso,INV-1,2026-09-18,2000.01,INR,Meals,PO-1`,
    );
    expect(decisions(result)[0].status).toBe("REVIEW");
  });

  it("classifies a high policy violation as HIGH_RISK", async () => {
    const result = await processCsv(
      `${header}\nContoso,INV-1,2026-09-18,10000.01,INR,Hotel,PO-1`,
    );
    expect(decisions(result)[0].status).toBe("HIGH_RISK");
  });

  it("classifies exact duplicates as HIGH_RISK", async () => {
    const result = await processCsv(
      `${header}\nContoso,INV-1,2026-09-18,1000,INR,Office,PO-1\nContoso,INV-1,2026-09-18,1000,INR,Office,PO-1`,
    );
    expect(decisions(result).map(({ status }) => status)).toEqual([
      "HIGH_RISK",
      "HIGH_RISK",
    ]);
  });

  it("classifies probable duplicates as REVIEW", async () => {
    const result = await processCsv(
      `${header}\nContoso,INV-1,2026-09-18,1000,INR,Office,PO-1\nContoso,INV-2,2026-09-19,1000,INR,Office,PO-2`,
    );
    expect(decisions(result).map(({ status }) => status)).toEqual(["REVIEW", "REVIEW"]);
  });

  it("classifies fuzzy duplicates as REVIEW", async () => {
    const result = await processCsv(
      `${header}\nContoso Consulting Pvt Ltd,INV-1,2026-09-18,1000,INR,Office,PO-1\nContoso Consultng Pvt Ltd,INV-2,2026-09-19,1000,INR,Office,PO-2`,
    );
    expect(decisions(result).map(({ status }) => status)).toEqual(["REVIEW", "REVIEW"]);
    expect(Object.values(result.duplicateMatches).flat()[0].matchType).toBe("FUZZY");
  });

  it("detects a duplicate across two uploaded files", async () => {
    const result = await processBatch([
      csvFile(`${header}\n${cleanRow}`, "first.csv"),
      csvFile(`${header}\n${cleanRow}`, "second.csv"),
    ], { ...fixedOptions, storage: new MemoryStorage() });
    expect(result.batchSummary.duplicateCandidates).toBe(2);
    expect(result.transactions.map(({ sourceFile }) => sourceFile)).toEqual([
      "first.csv",
      "second.csv",
    ]);
  });

  it("detects a duplicate across separate XLSX worksheets", async () => {
    const result = await processBatch([
      xlsxFile([
        { name: "North", rows: [["Vendor", "Invoice", "Invoice Date", "Amount", "Currency"], ["Contoso", "INV-1", "2026-09-18", 1000, "INR"]] },
        { name: "South", rows: [["Vendor", "Invoice", "Invoice Date", "Amount", "Currency"], ["Contoso", "INV-1", "2026-09-18", 1000, "INR"]] },
      ]),
    ], { ...fixedOptions, storage: new MemoryStorage() });
    expect(result.batchSummary.duplicateCandidates).toBe(2);
    expect(result.transactions.map(({ sourceSheet }) => sourceSheet)).toEqual(["North", "South"]);
  });
});

describe("pipeline associations", () => {
  it("associates rule results with the correct transaction", async () => {
    const result = await processCsv(`${header}\n${cleanRow}`);
    const id = result.transactions[0].id;
    expect(result.ruleResults[id].every(({ ruleId }) => typeof ruleId === "string")).toBe(true);
  });

  it("associates duplicate evidence with the engine-current transaction", async () => {
    const result = await processCsv(`${header}\n${cleanRow}\n${cleanRow}`);
    const firstId = result.transactions[0].id;
    expect(result.duplicateMatches[firstId][0].matchedTransactionId).toBe(result.transactions[1].id);
  });

  it("provides a mirrored lookup for the matched transaction", async () => {
    const result = await processCsv(`${header}\n${cleanRow}\n${cleanRow}`);
    const secondId = result.transactions[1].id;
    expect(result.duplicateMatches[secondId][0]).toMatchObject({
      currentTransactionId: secondId,
      matchedTransactionId: result.transactions[0].id,
    });
  });

  it("associates decisions with the correct transaction", async () => {
    const result = await processCsv(`${header}\n${cleanRow}`);
    const id = result.transactions[0].id;
    expect(result.decisions[id]).toMatchObject({ status: "AUTO_PASS" });
  });
});

describe("batch summary", () => {
  const summaryCsv = `${header}\nAlpha,A-1,2026-09-18,100,INR,Office,PO-1\nBravo,B-1,2026-09-18,2000.01,INR,Meals,PO-2\nCharlie,C-1,2026-09-18,10000.01,INR,Hotel,PO-3`;

  it("counts total processed transactions", async () => {
    expect((await processCsv(summaryCsv)).batchSummary.totalProcessed).toBe(3);
  });

  it("counts AUTO_PASS transactions", async () => {
    expect((await processCsv(summaryCsv)).batchSummary.autoPassed).toBe(1);
  });

  it("counts REVIEW transactions", async () => {
    expect((await processCsv(summaryCsv)).batchSummary.needsReview).toBe(1);
  });

  it("counts HIGH_RISK transactions", async () => {
    expect((await processCsv(summaryCsv)).batchSummary.highRisk).toBe(1);
  });

  it("counts each duplicate candidate transaction once", async () => {
    const rows = [cleanRow, cleanRow, cleanRow].join("\n");
    expect((await processCsv(`${header}\n${rows}`)).batchSummary.duplicateCandidates).toBe(3);
  });

  it("includes valid HIGH_RISK INR amounts in potential exposure", async () => {
    expect((await processCsv(summaryCsv)).batchSummary.potentialExposure).toBe(10000.01);
  });

  it("does not double-count exposure for transactions with multiple duplicate matches", async () => {
    const rows = [
      "Contoso,INV-1,2026-09-18,100,INR,Office,PO-1",
      "Contoso,INV-1,2026-09-18,100,INR,Office,PO-1",
      "Contoso,INV-1,2026-09-18,100,INR,Office,PO-1",
    ].join("\n");
    expect((await processCsv(`${header}\n${rows}`)).batchSummary.potentialExposure).toBe(300);
  });

  it("excludes AUTO_PASS amounts from potential exposure", async () => {
    expect((await processCsv(`${header}\n${cleanRow}`)).batchSummary.potentialExposure).toBe(0);
  });
});

describe("persistence and audit integration", () => {
  it("persists the analyzed batch", async () => {
    const storage = new MemoryStorage();
    const result = await processBatch([csvFile(`${header}\n${cleanRow}`)], {
      ...fixedOptions,
      storage,
    });
    expect(loadState(storage).currentBatch?.batchId).toBe(result.batchId);
  });

  it("persists the calculated BatchSummary", async () => {
    const storage = new MemoryStorage();
    const result = await processBatch([csvFile(`${header}\n${cleanRow}`)], {
      ...fixedOptions,
      storage,
    });
    expect(loadState(storage).currentBatch?.batchSummary).toEqual(
      result.batchSummary,
    );
  });

  it("persists transactions for later loading", async () => {
    const storage = new MemoryStorage();
    const result = await processBatch([csvFile(`${header}\n${cleanRow}`)], { ...fixedOptions, storage });
    expect(getTransaction(result.transactions[0].id, storage)?.invoiceNumber).toBe("INV-1");
  });

  it("persists decisions for later loading", async () => {
    const storage = new MemoryStorage();
    const result = await processBatch([csvFile(`${header}\n${cleanRow}`)], { ...fixedOptions, storage });
    expect(getDecision(result.transactions[0].id, storage)).toEqual(result.decisions[result.transactions[0].id]);
  });

  it("persists duplicate evidence for both transaction lookups", async () => {
    const storage = new MemoryStorage();
    const result = await processBatch([csvFile(`${header}\n${cleanRow}\n${cleanRow}`)], { ...fixedOptions, storage });
    expect(getDuplicateMatches(result.transactions[0].id, storage)).toHaveLength(1);
    expect(getDuplicateMatches(result.transactions[1].id, storage)).toHaveLength(1);
  });

  it("generates a BATCH_PROCESSED audit event", async () => {
    const result = await processCsv(`${header}\n${cleanRow}`);
    expect(result.auditEvents.some(({ action }) => action === "BATCH_PROCESSED")).toBe(true);
  });

  it("generates a DUPLICATE_DETECTED event with matched record evidence", async () => {
    const storage = new MemoryStorage();
    const result = await processBatch([csvFile(`${header}\n${cleanRow}\n${cleanRow}`)], { ...fixedOptions, storage });
    const event = result.auditEvents.find(({ action }) => action === "DUPLICATE_DETECTED");
    expect(event?.note).toContain(result.transactions[1].id);
  });

  it("generates and persists STATUS_ASSIGNED events", async () => {
    const storage = new MemoryStorage();
    const result = await processBatch([csvFile(`${header}\n${cleanRow}`)], { ...fixedOptions, storage });
    const id = result.transactions[0].id;
    expect(result.auditEvents.find(({ action }) => action === "STATUS_ASSIGNED")).toMatchObject({
      transactionId: id,
      newStatus: "AUTO_PASS",
    });
    expect(getAuditEvents(id, storage).some(({ action }) => action === "STATUS_ASSIGNED")).toBe(true);
  });

  it("persists rule results through the orchestrator", async () => {
    const storage = new MemoryStorage();
    const result = await processBatch([csvFile(`${header}\n${cleanRow}`)], { ...fixedOptions, storage });
    expect(getRuleResults(result.transactions[0].id, storage)).toHaveLength(13);
  });
});

describe("controlled and deterministic behavior", () => {
  it("returns structured errors when every file fails", async () => {
    const result = await processBatch([
      browserFile(["bad"], "broken.xlsx"),
      browserFile(["text"], "unsupported.txt"),
    ], { ...fixedOptions, storage: new MemoryStorage() });
    expect(result.transactions).toEqual([]);
    expect(result.batchSummary.totalProcessed).toBe(0);
    expect(result.fileErrors).toHaveLength(2);
  });

  it("produces stable decisions with a fixed reference date", async () => {
    const content = `${header}\nContoso,INV-1,2026-09-20,1000,INR,Office,PO-1`;
    const first = await processCsv(content);
    const second = await processCsv(content);
    expect(decisions(first)).toEqual(decisions(second));
    expect(decisions(first)[0].status).toBe("REVIEW");
  });
});

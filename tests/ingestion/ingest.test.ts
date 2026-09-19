import { File as NodeFile } from "node:buffer";

import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { ingestFiles } from "../../src/core/ingestion";

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
  for (const { name: sheetName, rows } of sheets) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      sheetName,
    );
  }
  const content = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return browserFile([content], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("file ingestion", () => {
  it("ingests a valid CSV using header aliases and normalized values", async () => {
    const result = await ingestFiles([
      csvFile(
        ' Vendor Name ,Invoice #,Invoice Date,Invoice Amount,Curr\nMicrosoft India Private Limited, INV-1 ,2026-09-19,"₹ 18,500",inr',
      ),
    ]);

    expect(result.fileErrors).toEqual([]);
    expect(result.filesProcessed).toBe(1);
    expect(result.rowsProcessed).toBe(1);
    expect(result.transactions[0]).toMatchObject({
      vendorName: "Microsoft India Private Limited",
      normalizedVendor: "microsoft india pvt ltd",
      invoiceNumber: "INV-1",
      invoiceDate: "2026-09-19",
      amount: 18500,
      currency: "INR",
    });
  });

  it("ingests a valid XLSX", async () => {
    const result = await ingestFiles([
      xlsxFile([
        {
          name: "Invoices",
          rows: [["Supplier", "Invoice No", "Amount"], ["Contoso", "C-1", 400]],
        },
      ]),
    ]);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].amount).toBe(400);
  });

  it("processes every non-empty worksheet", async () => {
    const result = await ingestFiles([
      xlsxFile([
        { name: "North", rows: [["Vendor"], ["Contoso"]] },
        { name: "South", rows: [["Vendor"], ["Fabrikam"]] },
      ]),
    ]);

    expect(result.transactions.map((transaction) => transaction.sourceSheet)).toEqual([
      "North",
      "South",
    ]);
  });

  it("skips empty worksheets safely", async () => {
    const result = await ingestFiles([
      xlsxFile([
        { name: "Empty", rows: [] },
        { name: "Data", rows: [["Vendor"], ["Contoso"]] },
      ]),
    ]);

    expect(result.fileErrors).toEqual([]);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].sourceSheet).toBe("Data");
  });

  it("returns a structured error for an unsupported extension", async () => {
    const result = await ingestFiles([csvFile("hello", "notes.txt")]);

    expect(result.fileErrors[0]).toMatchObject({
      fileName: "notes.txt",
      code: "UNSUPPORTED_EXTENSION",
    });
  });

  it("returns a structured error for malformed XLSX", async () => {
    const result = await ingestFiles([
      browserFile(["not a workbook"], "broken.xlsx"),
    ]);

    expect(result.fileErrors[0]?.code).toBe("CORRUPT_XLSX");
  });

  it("returns a structured error for an empty file", async () => {
    const result = await ingestFiles([csvFile("")]);

    expect(result.fileErrors[0]?.code).toBe("EMPTY_FILE");
  });

  it("does not invent a missing vendor", async () => {
    const result = await ingestFiles([
      csvFile("Invoice,Amount\nINV-1,100"),
    ]);

    expect(result.transactions[0].vendorName).toBeUndefined();
    expect(result.transactions[0].normalizedVendor).toBeUndefined();
  });

  it("does not invent a missing invoice number", async () => {
    const result = await ingestFiles([csvFile("Vendor,Amount\nContoso,100")]);

    expect(result.transactions[0].invoiceNumber).toBeUndefined();
  });

  it("preserves source file, sheet, and original row number", async () => {
    const result = await ingestFiles([
      csvFile("Vendor,Amount\n\nContoso,100", "batch.csv"),
    ]);

    expect(result.transactions[0]).toMatchObject({
      sourceFile: "batch.csv",
      sourceSheet: "CSV",
      sourceRow: 3,
    });
  });

  it("tolerates capitalization, whitespace, and punctuation in headers", async () => {
    const result = await ingestFiles([
      csvFile(" VENDOR-NAME ,INVOICE-NUMBER\nContoso,INV-1"),
    ]);

    expect(result.transactions[0]).toMatchObject({
      vendorName: "Contoso",
      invoiceNumber: "INV-1",
    });
  });

  it("creates one batch ID and unique transaction IDs", async () => {
    const result = await ingestFiles([
      csvFile("Vendor\nContoso\nFabrikam"),
    ]);

    expect(new Set(result.transactions.map(({ batchId }) => batchId)).size).toBe(1);
    expect(new Set(result.transactions.map(({ id }) => id)).size).toBe(2);
  });

  it("continues processing good files after a bad file", async () => {
    const result = await ingestFiles([
      browserFile(["bad"], "bad.xlsx"),
      csvFile("Vendor,Amount\nContoso,100", "good.csv"),
    ]);

    expect(result.fileErrors).toHaveLength(1);
    expect(result.filesProcessed).toBe(1);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].sourceFile).toBe("good.csv");
  });
});

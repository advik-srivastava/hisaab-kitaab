import * as XLSX from "xlsx";

import type { RawTransaction, Transaction } from "../../types/transaction";
import { normalizeTransaction } from "../normalization";

import { mapHeaders, type CanonicalField } from "./headers";
import type {
  IngestionErrorCode,
  IngestionFileError,
  IngestionResult,
} from "./types";

let batchSequence = 0;

function createBatchId(): string {
  batchSequence += 1;
  return `batch-${Date.now()}-${batchSequence}`;
}

function isBlankRow(row: unknown[]): boolean {
  return row.every(
    (value) => value === null || value === undefined || String(value).trim() === "",
  );
}

function rowsFromSheet(
  sheet: XLSX.WorkSheet,
  sourceFile: string,
  sourceSheet: string,
): RawTransaction[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: undefined,
    blankrows: true,
  });
  const headerIndex = rows.findIndex((row) => !isBlankRow(row));
  if (headerIndex === -1) {
    return [];
  }

  const mappedHeaders = mapHeaders(rows[headerIndex]);
  const records: RawTransaction[] = [];

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (isBlankRow(row)) {
      continue;
    }

    const values: Partial<Record<CanonicalField, unknown>> = {};
    mappedHeaders.forEach((field, columnIndex) => {
      if (field && values[field] === undefined) {
        values[field] = row[columnIndex];
      }
    });

    records.push({
      ...values,
      sourceFile,
      sourceSheet,
      sourceRow: rowIndex + 1,
    });
  }

  return records;
}

function hasZipSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08))
  );
}

function fileError(
  fileName: string,
  code: IngestionErrorCode,
  message: string,
): IngestionFileError {
  return { fileName, code, message };
}

async function readFile(file: File): Promise<
  | { records: RawTransaction[] }
  | { error: IngestionFileError }
> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "csv" && extension !== "xlsx") {
    return {
      error: fileError(
        file.name,
        "UNSUPPORTED_EXTENSION",
        "Only CSV and XLSX files are supported.",
      ),
    };
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return {
      error: fileError(
        file.name,
        "UNREADABLE_CONTENT",
        "The file could not be read.",
      ),
    };
  }

  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) {
    return {
      error: fileError(file.name, "EMPTY_FILE", "The file is empty."),
    };
  }

  if (extension === "csv") {
    const text = new TextDecoder().decode(bytes);
    if (!text.trim()) {
      return {
        error: fileError(file.name, "EMPTY_FILE", "The file is empty."),
      };
    }

    try {
      const workbook = XLSX.read(text, { type: "string", raw: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      return {
        records: firstSheet
          ? rowsFromSheet(firstSheet, file.name, "CSV")
          : [],
      };
    } catch {
      return {
        error: fileError(
          file.name,
          "UNREADABLE_CONTENT",
          "The CSV content could not be parsed.",
        ),
      };
    }
  }

  if (!hasZipSignature(bytes)) {
    return {
      error: fileError(
        file.name,
        "CORRUPT_XLSX",
        "The XLSX file is corrupt or invalid.",
      ),
    };
  }

  try {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const records = workbook.SheetNames.flatMap((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      return sheet ? rowsFromSheet(sheet, file.name, sheetName) : [];
    });
    return { records };
  } catch {
    return {
      error: fileError(
        file.name,
        "CORRUPT_XLSX",
        "The XLSX file is corrupt or invalid.",
      ),
    };
  }
}

export async function ingestFiles(files: Iterable<File>): Promise<IngestionResult> {
  const batchId = createBatchId();
  const createdAt = new Date().toISOString();
  const transactions: Transaction[] = [];
  const fileErrors: IngestionFileError[] = [];
  let filesProcessed = 0;

  for (const file of files) {
    const result = await readFile(file);
    if ("error" in result) {
      fileErrors.push(result.error);
      continue;
    }

    filesProcessed += 1;
    for (const raw of result.records) {
      const id = `${batchId}-${transactions.length + 1}`;
      transactions.push(
        normalizeTransaction(raw, { id, batchId, createdAt }),
      );
    }
  }

  return {
    batchId,
    transactions,
    fileErrors,
    filesProcessed,
    rowsProcessed: transactions.length,
  };
}

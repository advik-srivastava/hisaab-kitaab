import type { Transaction } from "../../types/transaction";

export type IngestionErrorCode =
  | "UNSUPPORTED_EXTENSION"
  | "EMPTY_FILE"
  | "CORRUPT_XLSX"
  | "UNREADABLE_CONTENT";

export interface IngestionFileError {
  fileName: string;
  code: IngestionErrorCode;
  message: string;
}

export interface IngestionResult {
  batchId: string;
  transactions: Transaction[];
  fileErrors: IngestionFileError[];
  filesProcessed: number;
  rowsProcessed: number;
}

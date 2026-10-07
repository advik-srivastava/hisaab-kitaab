import { createHash, randomUUID } from "node:crypto";

import { PlatformError } from "../platform/errors";

const allowedMimeTypes: Record<string, ReadonlySet<string>> = {
  csv: new Set(["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"]),
  xlsx: new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"]),
};

export interface UploadInspection {
  originalFilename: string;
  storageFilename: string;
  extension: "csv" | "xlsx";
  contentType: string;
  byteSize: number;
  sha256: string;
}

function safeExtension(filename: string): "csv" | "xlsx" {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension !== "csv" && extension !== "xlsx") {
    throw new PlatformError("VALIDATION_ERROR", "Only CSV and XLSX files are supported.", 400);
  }
  return extension;
}

function hasXlsxSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && ((bytes[2] === 0x03 && bytes[3] === 0x04)
      || (bytes[2] === 0x05 && bytes[3] === 0x06)
      || (bytes[2] === 0x07 && bytes[3] === 0x08));
}

export function inspectUpload(
  originalFilename: string,
  contentType: string,
  bytes: Uint8Array,
  maximumBytes = 25 * 1024 * 1024,
): UploadInspection {
  const extension = safeExtension(originalFilename);
  if (bytes.byteLength === 0) throw new PlatformError("VALIDATION_ERROR", "The uploaded file is empty.", 400);
  if (bytes.byteLength > maximumBytes) throw new PlatformError("VALIDATION_ERROR", `The uploaded file exceeds the ${maximumBytes}-byte limit.`, 413);
  const normalizedMime = contentType.toLowerCase().split(";")[0].trim();
  if (!allowedMimeTypes[extension].has(normalizedMime)) {
    throw new PlatformError("VALIDATION_ERROR", "The file MIME type does not match an allowed Finance upload format.", 400);
  }
  if (extension === "xlsx" && !hasXlsxSignature(bytes)) {
    throw new PlatformError("VALIDATION_ERROR", "The XLSX content signature is invalid.", 400);
  }
  if (extension === "csv" && bytes.some((byte) => byte === 0)) {
    throw new PlatformError("VALIDATION_ERROR", "The CSV contains invalid binary content.", 400);
  }
  return {
    originalFilename,
    storageFilename: `${randomUUID()}.${extension}`,
    extension,
    contentType: normalizedMime,
    byteSize: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

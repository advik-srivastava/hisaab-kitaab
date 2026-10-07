export const MAX_UPLOAD_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export function isSupportedUploadFile(fileName: string): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension === "csv" || extension === "xlsx";
}

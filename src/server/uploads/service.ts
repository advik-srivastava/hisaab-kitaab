import { randomUUID } from "node:crypto";

import { authorize } from "../platform/authorization";
import { PlatformError } from "../platform/errors";
import type { PlatformRepository } from "../platform/repository";
import type { AuthenticatedPrincipal, SourceFileRecord } from "../platform/types";
import { inspectUpload } from "./security";
import type { MalwareScanner, ObjectStorageProvider } from "./storage";

export class SecureUploadService {
  constructor(
    private readonly repository: PlatformRepository,
    private readonly objectStorage: ObjectStorageProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async upload(
    principal: AuthenticatedPrincipal | undefined,
    batchId: string,
    file: { name: string; type: string; bytes: Uint8Array },
  ): Promise<{ file: SourceFileRecord; duplicateUpload: boolean }> {
    const user = authorize(principal, "READ_FINANCE");
    const inspection = inspectUpload(file.name, file.type, file.bytes);
    const existing = await this.repository.findSourceFileByHash(user.organizationId, inspection.sha256);
    const blobKey = `${user.organizationId}/${batchId}/${inspection.storageFilename}`;
    await this.objectStorage.put(blobKey, file.bytes, inspection.contentType);
    const timestamp = this.now().toISOString();
    const record: SourceFileRecord = {
      id: randomUUID(),
      organizationId: user.organizationId,
      batchId,
      originalFilename: inspection.originalFilename,
      storageFilename: inspection.storageFilename,
      contentType: inspection.contentType,
      byteSize: inspection.byteSize,
      sha256: inspection.sha256,
      scanStatus: "PENDING_SCAN",
      blobKey,
      uploadedAt: timestamp,
    };
    await Promise.all([
      this.repository.saveSourceFile(record),
      this.repository.appendAudit({
        id: randomUUID(),
        organizationId: user.organizationId,
        timestamp,
        actorId: user.userId,
        actorRole: user.role,
        action: "FILE_UPLOADED",
        batchId,
        note: file.name,
        metadata: { fileId: record.id, duplicateUpload: Boolean(existing), scanStatus: record.scanStatus },
      }),
    ]);
    return { file: record, duplicateUpload: Boolean(existing) };
  }

  async recordScanResult(
    principal: AuthenticatedPrincipal | undefined,
    batchId: string,
    fileId: string,
    scanner: MalwareScanner,
  ): Promise<SourceFileRecord> {
    const user = authorize(principal, "READ_FINANCE");
    const existing = (await this.repository.getSourceFiles(user.organizationId, batchId)).find(({ id }) => id === fileId);
    if (!existing?.blobKey) throw new PlatformError("NOT_FOUND", "Source file was not found.", 404);
    const result = await scanner.scan(existing.blobKey);
    const updated: SourceFileRecord = { ...existing, scanStatus: result };
    const timestamp = this.now().toISOString();
    await Promise.all([
      this.repository.saveSourceFile(updated),
      this.repository.appendAudit({
        id: randomUUID(), organizationId: user.organizationId, timestamp,
        actorId: null, actorRole: "SYSTEM", action: "FILE_SCAN_RESULT", batchId,
        note: result, metadata: { fileId },
      }),
    ]);
    return updated;
  }
}

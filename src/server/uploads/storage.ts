import { PlatformError } from "../platform/errors";

export interface StoredObject {
  key: string;
  bytes: Uint8Array;
  contentType: string;
}

export interface ObjectStorageProvider {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | undefined>;
  delete(key: string): Promise<void>;
  health(): Promise<"healthy" | "unavailable">;
}

export class InMemoryObjectStorage implements ObjectStorageProvider {
  private readonly objects = new Map<string, StoredObject>();

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    this.objects.set(key, { key, bytes: bytes.slice(), contentType });
  }
  async get(key: string): Promise<StoredObject | undefined> {
    const object = this.objects.get(key);
    return object ? { ...object, bytes: object.bytes.slice() } : undefined;
  }
  async delete(key: string): Promise<void> { this.objects.delete(key); }
  async health(): Promise<"healthy"> { return "healthy"; }
}

export class AzureBlobStorageProvider implements ObjectStorageProvider {
  constructor(private readonly configured: boolean) {}
  private unavailable(): never {
    throw new PlatformError(
      "CONFIGURATION_REQUIRED",
      "AZURE BLOB CONFIGURATION REQUIRED: configure the container and an approved managed-identity/SDK adapter.",
      503,
    );
  }
  async put(): Promise<void> { this.unavailable(); }
  async get(): Promise<StoredObject | undefined> { return this.unavailable(); }
  async delete(): Promise<void> { this.unavailable(); }
  async health(): Promise<"unavailable"> {
    void this.configured;
    return "unavailable";
  }
}

export interface MalwareScanner {
  scan(key: string): Promise<"CLEAN" | "INFECTED" | "SCAN_FAILED">;
}

export class ConfigurationRequiredScanner implements MalwareScanner {
  async scan(): Promise<never> {
    throw new PlatformError("CONFIGURATION_REQUIRED", "MALWARE SCANNER CONFIGURATION REQUIRED.", 503);
  }
}

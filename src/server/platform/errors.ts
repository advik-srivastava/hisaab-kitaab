export class PlatformError extends Error {
  constructor(
    readonly code:
      | "UNAUTHENTICATED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "CONFLICT"
      | "VALIDATION_ERROR"
      | "CONFIGURATION_REQUIRED"
      | "STORAGE_ERROR",
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PlatformError";
  }
}

export function configurationRequired(message: string): never {
  throw new PlatformError("CONFIGURATION_REQUIRED", message, 503);
}

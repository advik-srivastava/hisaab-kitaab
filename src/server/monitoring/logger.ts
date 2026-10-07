export type LogLevel = "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  batchId?: string;
  transactionId?: string;
  organizationId?: string;
  durationMs?: number;
  errorCode?: string;
}

export interface StructuredLogger {
  log(level: LogLevel, event: string, context?: LogContext): void;
}

export class JsonConsoleLogger implements StructuredLogger {
  log(level: LogLevel, event: string, context: LogContext = {}): void {
    const record = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...context });
    if (level === "error") console.error(record);
    else if (level === "warn") console.warn(record);
    else console.info(record);
  }
}

export interface TelemetryProvider {
  track(event: string, context?: LogContext): void;
}

export class ConfigurationRequiredTelemetry implements TelemetryProvider {
  track(): void {
    // Intentionally no-op until Application Insights is configured; no success is reported.
  }
}

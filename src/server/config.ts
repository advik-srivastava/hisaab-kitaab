import { PlatformError } from "./platform/errors";
import type { AppMode, RetentionPolicy } from "./platform/types";

export interface ServerConfiguration {
  appMode: AppMode;
  applicationUrl: string;
  repository: "memory" | "azure-sql";
  authProvider: "demo" | "entra";
  sessionSecret?: string;
  azureSqlConnectionString?: string;
  azureBlobConnectionString?: string;
  azureBlobContainer?: string;
  azureServiceBusConnectionString?: string;
  azureServiceBusQueue?: string;
  applicationInsightsConnectionString?: string;
  retention: RetentionPolicy;
}

export interface IntegrationStatus {
  database: "CONFIGURED" | "CONFIGURATION_REQUIRED";
  blobStorage: "CONFIGURED" | "CONFIGURATION_REQUIRED";
  serviceBus: "CONFIGURED" | "CONFIGURATION_REQUIRED";
  monitoring: "CONFIGURED" | "CONFIGURATION_REQUIRED";
  authentication: "CONFIGURED" | "CONFIGURATION_REQUIRED" | "DEVELOPMENT_ONLY";
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getServerConfiguration(env: NodeJS.ProcessEnv = process.env): ServerConfiguration {
  const appMode = env.APP_MODE === "SERVER" ? "SERVER" : "LOCAL_DEMO";
  return {
    appMode,
    applicationUrl: env.APPLICATION_URL ?? "http://localhost:3000",
    repository: env.SERVER_REPOSITORY === "azure-sql" ? "azure-sql" : "memory",
    authProvider: env.AUTH_PROVIDER === "entra" ? "entra" : "demo",
    sessionSecret: env.SESSION_SECRET,
    azureSqlConnectionString: env.AZURE_SQL_CONNECTION_STRING,
    azureBlobConnectionString: env.AZURE_STORAGE_CONNECTION_STRING,
    azureBlobContainer: env.AZURE_STORAGE_CONTAINER,
    azureServiceBusConnectionString: env.AZURE_SERVICE_BUS_CONNECTION_STRING,
    azureServiceBusQueue: env.AZURE_SERVICE_BUS_QUEUE,
    applicationInsightsConnectionString: env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    retention: {
      uploadedFilesDays: positiveInteger(env.RETENTION_UPLOADED_FILES_DAYS, 90),
      transactionDataDays: positiveInteger(env.RETENTION_TRANSACTION_DAYS, 365),
      auditEventsDays: positiveInteger(env.RETENTION_AUDIT_DAYS, 2555),
      reportsDays: positiveInteger(env.RETENTION_REPORT_DAYS, 90),
    },
  };
}

export function requireServerSecret(configuration: ServerConfiguration): string {
  if (!configuration.sessionSecret || configuration.sessionSecret.length < 32) {
    throw new PlatformError(
      "CONFIGURATION_REQUIRED",
      "SESSION_SECRET must contain at least 32 characters in SERVER mode.",
      503,
    );
  }
  return configuration.sessionSecret;
}

export function integrationStatus(configuration = getServerConfiguration()): IntegrationStatus {
  // Environment values alone do not prove an external adapter/resource is operational.
  // Keep these integrations unavailable until a real provider implementation passes health checks.
  void configuration.azureSqlConnectionString;
  void configuration.azureBlobConnectionString;
  void configuration.azureServiceBusConnectionString;
  void configuration.applicationInsightsConnectionString;
  return {
    database: "CONFIGURATION_REQUIRED",
    blobStorage: "CONFIGURATION_REQUIRED",
    serviceBus: "CONFIGURATION_REQUIRED",
    monitoring: "CONFIGURATION_REQUIRED",
    authentication: configuration.authProvider === "entra" ? "CONFIGURATION_REQUIRED" : "DEVELOPMENT_ONLY",
  };
}

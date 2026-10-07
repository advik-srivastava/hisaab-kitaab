import { PlatformError } from "../platform/errors";

export interface ManagedBackupConfiguration {
  databasePointInTimeRestoreConfigured: boolean;
  objectVersioningConfigured: boolean;
  objectSoftDeleteConfigured: boolean;
  recoveryRunbookUrl?: string;
}

export function getManagedBackupConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): ManagedBackupConfiguration {
  return {
    databasePointInTimeRestoreConfigured: env.AZURE_SQL_BACKUP_CONFIGURED === "true",
    objectVersioningConfigured: env.AZURE_STORAGE_VERSIONING_CONFIGURED === "true",
    objectSoftDeleteConfigured: env.AZURE_STORAGE_SOFT_DELETE_CONFIGURED === "true",
    recoveryRunbookUrl: env.RECOVERY_RUNBOOK_URL,
  };
}

export function requireManagedRecoveryConfiguration(
  configuration = getManagedBackupConfiguration(),
): ManagedBackupConfiguration {
  if (
    !configuration.databasePointInTimeRestoreConfigured
    || !configuration.objectVersioningConfigured
    || !configuration.objectSoftDeleteConfigured
    || !configuration.recoveryRunbookUrl
  ) {
    throw new PlatformError(
      "CONFIGURATION_REQUIRED",
      "MANAGED BACKUP CONFIGURATION REQUIRED: enable Azure SQL recovery, Blob versioning/soft delete, and provide the recovery runbook URL.",
      503,
    );
  }
  return configuration;
}

import { getServerConfiguration } from "../config";
import { configurationRequired } from "./errors";
import { MemoryPlatformRepository } from "./memoryRepository";
import type { PlatformRepository } from "./repository";
import { PlatformService } from "./service";

let developmentRepository: MemoryPlatformRepository | undefined;

export function getPlatformRepository(): PlatformRepository {
  const configuration = getServerConfiguration();
  if (configuration.repository === "azure-sql") {
    configurationRequired(
      "AZURE SQL CONFIGURATION REQUIRED: install/configure the approved Azure SQL driver and AZURE_SQL_CONNECTION_STRING.",
    );
  }
  if (process.env.NODE_ENV === "production" && configuration.appMode === "SERVER") {
    configurationRequired("A durable server repository is required in production SERVER mode.");
  }
  developmentRepository ??= new MemoryPlatformRepository();
  return developmentRepository;
}

export function getPlatformService(): PlatformService {
  return new PlatformService(getPlatformRepository());
}

export function resetDevelopmentRepository(): void {
  developmentRepository = undefined;
}

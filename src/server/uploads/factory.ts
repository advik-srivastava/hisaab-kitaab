import { getServerConfiguration } from "../config";
import { AzureBlobStorageProvider, InMemoryObjectStorage, type ObjectStorageProvider } from "./storage";

let developmentStorage: InMemoryObjectStorage | undefined;

export function getObjectStorage(): ObjectStorageProvider {
  const configuration = getServerConfiguration();
  if (configuration.azureBlobConnectionString && configuration.azureBlobContainer) {
    return new AzureBlobStorageProvider(true);
  }
  if (configuration.appMode === "SERVER" && process.env.NODE_ENV === "production") {
    return new AzureBlobStorageProvider(false);
  }
  developmentStorage ??= new InMemoryObjectStorage();
  return developmentStorage;
}

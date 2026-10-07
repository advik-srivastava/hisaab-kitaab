import { getServerConfiguration } from "../config";
import { AzureServiceBusJobQueue, InMemoryProcessingJobQueue, type ProcessingJobQueue } from "./jobs";

let developmentQueue: InMemoryProcessingJobQueue | undefined;

export function getProcessingJobQueue(): ProcessingJobQueue {
  const configuration = getServerConfiguration();
  if (configuration.azureServiceBusConnectionString && configuration.azureServiceBusQueue) {
    return new AzureServiceBusJobQueue();
  }
  if (configuration.appMode === "SERVER" && process.env.NODE_ENV === "production") {
    return new AzureServiceBusJobQueue();
  }
  developmentQueue ??= new InMemoryProcessingJobQueue();
  return developmentQueue;
}

export function resetDevelopmentJobQueue(): void {
  developmentQueue = undefined;
}

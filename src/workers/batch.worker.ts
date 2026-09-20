/// <reference lib="webworker" />

import { executeProcessBatchRequest } from "../lib/worker/execute";
import type { ProcessBatchWorkerRequest } from "../lib/worker/protocol";

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.addEventListener("message", (event: MessageEvent<ProcessBatchWorkerRequest>) => {
  if (event.data?.type !== "PROCESS_BATCH") return;
  void executeProcessBatchRequest(event.data, (response) => {
    workerScope.postMessage(response);
  });
});

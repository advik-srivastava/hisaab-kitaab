import { randomUUID } from "node:crypto";

import { PlatformError } from "../platform/errors";
import type { BatchProcessingStatus } from "../platform/types";

export interface ProcessingJob {
  id: string;
  organizationId: string;
  batchId: string;
  state: BatchProcessingStatus;
  progressStage?: string;
  processed?: number;
  total?: number;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface ProcessingJobQueue {
  enqueue(input: Omit<ProcessingJob, "id" | "state" | "queuedAt">): Promise<ProcessingJob>;
  get(organizationId: string, jobId: string): Promise<ProcessingJob | undefined>;
  update(organizationId: string, jobId: string, state: BatchProcessingStatus, progress?: Partial<ProcessingJob>): Promise<ProcessingJob>;
  health(): Promise<"healthy" | "unavailable">;
}

const transitions: Record<BatchProcessingStatus, ReadonlySet<BatchProcessingStatus>> = {
  UPLOADING: new Set(["QUEUED", "FAILED"]),
  QUEUED: new Set(["PROCESSING", "FAILED"]),
  PROCESSING: new Set(["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"]),
  COMPLETED: new Set(),
  COMPLETED_WITH_ERRORS: new Set(),
  FAILED: new Set(),
};

export function assertJobTransition(from: BatchProcessingStatus, to: BatchProcessingStatus): void {
  if (!transitions[from].has(to)) {
    throw new PlatformError("CONFLICT", `Processing job cannot move from ${from} to ${to}.`, 409);
  }
}

export class InMemoryProcessingJobQueue implements ProcessingJobQueue {
  private readonly jobs = new Map<string, ProcessingJob>();
  constructor(private readonly now: () => Date = () => new Date()) {}

  async enqueue(input: Omit<ProcessingJob, "id" | "state" | "queuedAt">): Promise<ProcessingJob> {
    const job: ProcessingJob = { ...input, id: randomUUID(), state: "QUEUED", queuedAt: this.now().toISOString() };
    this.jobs.set(`${job.organizationId}:${job.id}`, structuredClone(job));
    return job;
  }

  async get(organizationId: string, jobId: string): Promise<ProcessingJob | undefined> {
    const job = this.jobs.get(`${organizationId}:${jobId}`);
    return job ? structuredClone(job) : undefined;
  }

  async update(organizationId: string, jobId: string, state: BatchProcessingStatus, progress: Partial<ProcessingJob> = {}): Promise<ProcessingJob> {
    const key = `${organizationId}:${jobId}`;
    const current = this.jobs.get(key);
    if (!current) throw new PlatformError("NOT_FOUND", "Processing job was not found.", 404);
    assertJobTransition(current.state, state);
    const timestamp = this.now().toISOString();
    const next: ProcessingJob = {
      ...current,
      ...progress,
      state,
      startedAt: state === "PROCESSING" ? timestamp : current.startedAt,
      completedAt: ["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"].includes(state) ? timestamp : current.completedAt,
    };
    this.jobs.set(key, structuredClone(next));
    return next;
  }

  async health(): Promise<"healthy"> { return "healthy"; }
}

export class AzureServiceBusJobQueue implements ProcessingJobQueue {
  private unavailable(): never {
    throw new PlatformError(
      "CONFIGURATION_REQUIRED",
      "AZURE SERVICE BUS CONFIGURATION REQUIRED: configure the queue and approved managed-identity/SDK adapter.",
      503,
    );
  }
  async enqueue(): Promise<ProcessingJob> { return this.unavailable(); }
  async get(): Promise<ProcessingJob | undefined> { return this.unavailable(); }
  async update(): Promise<ProcessingJob> { return this.unavailable(); }
  async health(): Promise<"unavailable"> { return "unavailable"; }
}

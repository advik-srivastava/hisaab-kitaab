import { NextResponse, type NextRequest } from "next/server";

import { apiHandler } from "@/server/http";
import { getProcessingJobQueue } from "@/server/jobs/factory";
import { authorize, getPlatformRepository, PlatformError } from "@/server/platform";

export async function POST(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => {
    const user = authorize(principal, "READ_FINANCE");
    const body = await request.json() as { batchId?: unknown };
    if (typeof body.batchId !== "string" || !body.batchId.trim()) {
      throw new PlatformError("VALIDATION_ERROR", "A batch ID is required.", 400);
    }
    const repository = getPlatformRepository();
    if (!await repository.getActivePolicy(user.organizationId)) {
      throw new PlatformError(
        "VALIDATION_ERROR",
        "An active company policy is required before processing invoices.",
        409,
      );
    }
    const job = await getProcessingJobQueue().enqueue({
      organizationId: user.organizationId,
      batchId: body.batchId,
    });
    await repository.appendAudit({
      id: crypto.randomUUID(), organizationId: user.organizationId, timestamp: new Date().toISOString(),
      actorId: user.userId, actorRole: user.role, action: "BATCH_CREATED", batchId: body.batchId,
      metadata: { jobId: job.id, state: job.state },
    });
    return NextResponse.json(job, { status: 202 });
  });
}

export async function GET(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => {
    const user = authorize(principal, "READ_FINANCE");
    const jobId = request.nextUrl.searchParams.get("id");
    if (!jobId) throw new PlatformError("VALIDATION_ERROR", "A job ID is required.", 400);
    const job = await getProcessingJobQueue().get(user.organizationId, jobId);
    if (!job) throw new PlatformError("NOT_FOUND", "Processing job was not found.", 404);
    return NextResponse.json(job);
  });
}

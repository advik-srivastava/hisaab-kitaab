import { NextResponse, type NextRequest } from "next/server";

import { apiHandler } from "@/server/http";
import { getPlatformService, PlatformError } from "@/server/platform";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return apiHandler(request, async ({ principal }) => {
    const { id } = await context.params;
    return NextResponse.json(await getPlatformService().getExceptionDetail(principal, id));
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return apiHandler(request, async ({ principal }) => {
    const { id } = await context.params;
    const body = await request.json() as { operation?: unknown; action?: unknown; reviewerId?: unknown; note?: unknown; expectedVersion?: unknown };
    if (!Number.isInteger(body.expectedVersion)) throw new PlatformError("VALIDATION_ERROR", "An expected version is required.", 400);
    const service = getPlatformService();
    if (body.operation === "ASSIGN" && typeof body.reviewerId === "string") {
      return NextResponse.json(await service.assignException(principal, { transactionId: id, reviewerId: body.reviewerId, expectedVersion: body.expectedVersion as number }));
    }
    if (body.operation === "REVIEW" && (body.action === "APPROVE" || body.action === "REJECT" || body.action === "MARK_NOT_DUPLICATE")) {
      return NextResponse.json(await service.reviewException(principal, {
        transactionId: id,
        action: body.action,
        note: typeof body.note === "string" ? body.note : undefined,
        expectedVersion: body.expectedVersion as number,
      }));
    }
    throw new PlatformError("VALIDATION_ERROR", "The exception update is invalid.", 400);
  });
}

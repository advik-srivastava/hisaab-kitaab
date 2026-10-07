import { NextResponse, type NextRequest } from "next/server";

import { apiHandler, exceptionQueryFromUrl } from "@/server/http";
import { getPlatformService, PlatformError } from "@/server/platform";

export async function GET(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => {
    const query = exceptionQueryFromUrl(request.nextUrl);
    const service = getPlatformService();
    return NextResponse.json(query.assignedReviewerId === "me"
      ? await service.queryMyQueue(principal, { ...query, assignedReviewerId: undefined })
      : await service.queryExceptions(principal, query));
  });
}

export async function POST(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => {
    const body = await request.json() as {
      operation?: unknown;
      action?: unknown;
      reviewerId?: unknown;
      note?: unknown;
      items?: Array<{ transactionId?: unknown; expectedVersion?: unknown }>;
    };
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 500) {
      throw new PlatformError("VALIDATION_ERROR", "Select between 1 and 500 exceptions.", 400);
    }
    const items = body.items.map((item) => {
      if (typeof item.transactionId !== "string" || !Number.isInteger(item.expectedVersion)) {
        throw new PlatformError("VALIDATION_ERROR", "Each selected exception requires an ID and version.", 400);
      }
      return { transactionId: item.transactionId, expectedVersion: item.expectedVersion as number };
    });
    const service = getPlatformService();
    if (body.operation === "ASSIGN" && typeof body.reviewerId === "string") {
      return NextResponse.json(await service.bulkAssign(principal, { items, reviewerId: body.reviewerId }));
    }
    if (body.operation === "REVIEW" && (body.action === "APPROVE" || body.action === "REJECT" || body.action === "MARK_NOT_DUPLICATE")) {
      return NextResponse.json(await service.bulkReview(principal, {
        items,
        action: body.action,
        note: typeof body.note === "string" ? body.note : undefined,
      }));
    }
    throw new PlatformError("VALIDATION_ERROR", "The bulk operation is invalid.", 400);
  });
}

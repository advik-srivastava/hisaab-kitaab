import { NextResponse, type NextRequest } from "next/server";

import { apiHandler } from "@/server/http";
import { getPlatformRepository, getPlatformService, authorize, PlatformError, type ExceptionQuery } from "@/server/platform";

export async function GET(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => NextResponse.json({ items: await getPlatformService().listFilters(principal) }));
}

export async function POST(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => {
    const body = await request.json() as { name?: unknown; query?: unknown };
    if (typeof body.name !== "string" || !body.query || typeof body.query !== "object") {
      throw new PlatformError("VALIDATION_ERROR", "A name and query are required.", 400);
    }
    return NextResponse.json(await getPlatformService().saveFilter(principal, { name: body.name, query: body.query as ExceptionQuery }), { status: 201 });
  });
}

export async function DELETE(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => {
    const user = authorize(principal, "READ_FINANCE");
    const id = request.nextUrl.searchParams.get("id");
    if (!id) throw new PlatformError("VALIDATION_ERROR", "Filter ID is required.", 400);
    await getPlatformRepository().deleteFilter(user.organizationId, user.userId, id);
    return NextResponse.json({ success: true });
  });
}

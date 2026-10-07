import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/server/http";
import { authorize, getPlatformRepository, PlatformError, type UserRole } from "@/server/platform";

export async function GET(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => {
    const user = authorize(principal, "READ_FINANCE");
    return NextResponse.json({ items: await getPlatformRepository().listUsers(user.organizationId) });
  });
}

export async function POST(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => {
    const admin = authorize(principal, "MANAGE_USERS");
    const body = await request.json() as { id?: unknown; email?: unknown; displayName?: unknown; role?: unknown };
    if (typeof body.id !== "string" || typeof body.email !== "string" || typeof body.displayName !== "string" || !["ADMIN", "FINANCE_MANAGER", "REVIEWER", "AUDITOR"].includes(String(body.role))) {
      throw new PlatformError("VALIDATION_ERROR", "Valid user fields are required.", 400);
    }
    const record = {
      id: body.id, organizationId: admin.organizationId, email: body.email, displayName: body.displayName,
      role: body.role as UserRole, active: true, createdAt: new Date().toISOString(),
    };
    await getPlatformRepository().putUser(record);
    return NextResponse.json(record, { status: 201 });
  });
}

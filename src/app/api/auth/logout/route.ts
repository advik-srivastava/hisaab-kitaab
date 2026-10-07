import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/server/auth";
import { apiHandler } from "@/server/http";
import { getPlatformRepository } from "@/server/platform";

export async function POST(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => {
    if (principal) {
      await getPlatformRepository().appendAudit({
        id: crypto.randomUUID(), organizationId: principal.organizationId, timestamp: new Date().toISOString(),
        actorId: principal.userId, actorRole: principal.role, action: "LOGOUT",
      });
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return response;
  });
}

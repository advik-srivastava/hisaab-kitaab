import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/server/http";
import { getPlatformService } from "@/server/platform";

export async function GET(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => NextResponse.json({ items: await getPlatformService().listNotifications(principal) }));
}

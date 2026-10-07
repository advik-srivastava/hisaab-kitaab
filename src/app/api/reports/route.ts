import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/server/http";
import { getPlatformService } from "@/server/platform";

export async function GET(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => {
    const service = getPlatformService();
    const [trends, aging] = await Promise.all([service.trends(principal), service.aging(principal)]);
    return NextResponse.json({ trends, aging, insufficientHistory: trends.length < 2 });
  });
}

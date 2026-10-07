import type { NextRequest } from "next/server";
import { ExportService } from "@/server/exports/service";
import { apiHandler, downloadResponse } from "@/server/http";
import { getPlatformRepository, getPlatformService } from "@/server/platform";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return apiHandler(request, async ({ principal }) => {
    const { id } = await context.params;
    const generated = await new ExportService(getPlatformRepository(), getPlatformService()).batchReport(principal, id);
    return downloadResponse(generated.filename, generated.contentType, generated.bytes);
  });
}

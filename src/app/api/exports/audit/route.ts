import type { NextRequest } from "next/server";
import { ExportService } from "@/server/exports/service";
import { apiHandler, downloadResponse } from "@/server/http";
import { getPlatformRepository, getPlatformService } from "@/server/platform";

export async function GET(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => {
    const generated = await new ExportService(getPlatformRepository(), getPlatformService()).audit(
      principal,
      request.nextUrl.searchParams.get("batchId") ?? undefined,
    );
    return downloadResponse(generated.filename, generated.contentType, generated.bytes);
  });
}

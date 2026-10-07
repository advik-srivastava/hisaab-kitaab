import type { NextRequest } from "next/server";

import { ExportService } from "@/server/exports/service";
import { apiHandler, downloadResponse, exceptionQueryFromUrl } from "@/server/http";
import { getPlatformRepository, getPlatformService, PlatformError } from "@/server/platform";

export async function GET(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => {
    const format = request.nextUrl.searchParams.get("format") ?? "csv";
    if (format !== "csv" && format !== "xlsx") throw new PlatformError("VALIDATION_ERROR", "Export format must be csv or xlsx.", 400);
    const generated = await new ExportService(getPlatformRepository(), getPlatformService()).exceptions(
      principal,
      exceptionQueryFromUrl(request.nextUrl),
      format,
    );
    return downloadResponse(generated.filename, generated.contentType, generated.bytes);
  });
}

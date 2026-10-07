import { NextResponse, type NextRequest } from "next/server";

import { apiHandler } from "@/server/http";
import { getPlatformRepository, PlatformError } from "@/server/platform";
import { getObjectStorage, SecureUploadService } from "@/server/uploads";

export async function POST(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => {
    const form = await request.formData();
    const batchId = form.get("batchId");
    const file = form.get("file");
    if (typeof batchId !== "string" || !(file instanceof File)) {
      throw new PlatformError("VALIDATION_ERROR", "batchId and file are required.", 400);
    }
    const uploaded = await new SecureUploadService(getPlatformRepository(), getObjectStorage()).upload(
      principal,
      batchId,
      { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) },
    );
    return NextResponse.json(uploaded, { status: 201 });
  });
}

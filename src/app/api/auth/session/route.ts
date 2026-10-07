import { NextResponse, type NextRequest } from "next/server";

import { apiHandler } from "@/server/http";
import { authorize } from "@/server/platform";

export async function GET(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => NextResponse.json({ user: authorize(principal, "READ_FINANCE") }));
}

import { NextResponse, type NextRequest } from "next/server";

import { principalFromRequest } from "./auth";
import { JsonConsoleLogger } from "./monitoring/logger";
import { PlatformError } from "./platform/errors";
import type { ExceptionQuery } from "./platform/types";

const logger = new JsonConsoleLogger();

export function exceptionQueryFromUrl(url: URL): ExceptionQuery {
  const value = (name: string) => url.searchParams.get(name) || undefined;
  const number = (name: string) => {
    const raw = value(name);
    if (raw === undefined) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const status = value("status");
  const duplicateType = value("duplicateType");
  const reviewStatus = value("reviewStatus");
  const ageBucket = value("ageBucket");
  const sortBy = value("sortBy");
  const sortDirection = value("sortDirection");
  return {
    batchId: value("batchId"),
    status: status === "HIGH_RISK" || status === "REVIEW" ? status : "ALL",
    search: value("search"),
    assignedReviewerId: value("assignedReviewerId"),
    unassigned: value("unassigned") === "true" || undefined,
    department: value("department"),
    expenseCategory: value("expenseCategory"),
    dateFrom: value("dateFrom"),
    dateTo: value("dateTo"),
    amountMin: number("amountMin"),
    amountMax: number("amountMax"),
    duplicateType: duplicateType === "EXACT" || duplicateType === "PROBABLE" || duplicateType === "FUZZY" ? duplicateType : undefined,
    reviewStatus: reviewStatus === "REVIEWED" || reviewStatus === "UNREVIEWED" ? reviewStatus : undefined,
    ageBucket: ageBucket === "LT_1_DAY" || ageBucket === "ONE_TO_THREE_DAYS" || ageBucket === "FOUR_TO_SEVEN_DAYS" || ageBucket === "SEVEN_PLUS_DAYS" ? ageBucket : undefined,
    page: number("page"),
    pageSize: number("pageSize"),
    sortBy: sortBy === "risk" || sortBy === "amount" || sortBy === "invoiceDate" || sortBy === "vendor" || sortBy === "duplicateSimilarity" ? sortBy : undefined,
    sortDirection: sortDirection === "asc" ? "asc" : sortDirection === "desc" ? "desc" : undefined,
  };
}

export async function apiHandler(
  request: NextRequest,
  operation: (context: { principal: ReturnType<typeof principalFromRequest>; requestId: string }) => Promise<Response>,
): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const startedAt = performance.now();
  try {
    const response = await operation({ principal: principalFromRequest(request), requestId });
    response.headers.set("x-request-id", requestId);
    logger.log("info", "request_completed", { requestId, durationMs: performance.now() - startedAt });
    return response;
  } catch (error) {
    const platformError = error instanceof PlatformError
      ? error
      : new PlatformError("STORAGE_ERROR", "The request could not be completed.", 500);
    logger.log("error", "request_failed", { requestId, durationMs: performance.now() - startedAt, errorCode: platformError.code });
    return NextResponse.json(
      { error: { code: platformError.code, message: platformError.message }, requestId },
      { status: platformError.status, headers: { "x-request-id": requestId } },
    );
  }
}

export function downloadResponse(filename: string, contentType: string, bytes: Uint8Array): Response {
  return new Response(bytes as BodyInit, {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename.replaceAll('"', "")}"`,
      "cache-control": "no-store",
    },
  });
}

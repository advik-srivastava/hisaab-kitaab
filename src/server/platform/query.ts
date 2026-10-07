import type {
  AgeBucket,
  ExceptionPage,
  ExceptionQuery,
  ServerExceptionItem,
} from "./types";

export const DEFAULT_SERVER_PAGE_SIZE = 50;
export const MAX_SERVER_PAGE_SIZE = 200;

function ageInDays(createdAt: string, now: Date): number {
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) ? Math.max(0, Math.floor((now.getTime() - created) / 86_400_000)) : 0;
}

function inAgeBucket(age: number, bucket: AgeBucket): boolean {
  if (bucket === "LT_1_DAY") return age < 1;
  if (bucket === "ONE_TO_THREE_DAYS") return age >= 1 && age <= 3;
  if (bucket === "FOUR_TO_SEVEN_DAYS") return age >= 4 && age <= 7;
  return age >= 7;
}

function similarity(item: ServerExceptionItem): number {
  return Math.max(0, ...item.duplicateMatches.map(({ vendorSimilarity }) => vendorSimilarity ?? 0));
}

function riskRank(item: ServerExceptionItem): number {
  return item.decision.status === "HIGH_RISK" ? 2 : item.decision.status === "REVIEW" ? 1 : 0;
}

function compareItems(
  left: ServerExceptionItem,
  right: ServerExceptionItem,
  query: ExceptionQuery,
): number {
  const direction = query.sortDirection === "asc" ? 1 : -1;
  const sortBy = query.sortBy ?? "risk";
  let comparison = 0;
  if (sortBy === "risk") comparison = riskRank(left) - riskRank(right);
  if (sortBy === "amount") comparison = (left.transaction.amount ?? Number.NEGATIVE_INFINITY) - (right.transaction.amount ?? Number.NEGATIVE_INFINITY);
  if (sortBy === "invoiceDate") comparison = String(left.transaction.invoiceDate ?? "").localeCompare(String(right.transaction.invoiceDate ?? ""));
  if (sortBy === "vendor") comparison = String(left.transaction.vendorName ?? "").localeCompare(String(right.transaction.vendorName ?? ""));
  if (sortBy === "duplicateSimilarity") comparison = similarity(left) - similarity(right);
  return comparison * direction || left.transaction.id.localeCompare(right.transaction.id);
}

export function queryExceptionItems(
  source: readonly ServerExceptionItem[],
  query: ExceptionQuery,
  now = new Date(),
): ExceptionPage {
  const normalizedSearch = query.search?.trim().toLowerCase();
  const filtered = source.filter((item) => {
    const { transaction, decision, assignment, review, duplicateMatches } = item;
    if (decision.status === "AUTO_PASS") return false;
    if (query.batchId && transaction.batchId !== query.batchId) return false;
    if (query.status && query.status !== "ALL" && decision.status !== query.status) return false;
    if (normalizedSearch && ![
      transaction.invoiceNumber,
      transaction.vendorName,
      transaction.employeeId,
      transaction.department,
    ].some((value) => value?.toLowerCase().includes(normalizedSearch))) return false;
    if (query.assignedReviewerId && assignment?.reviewerId !== query.assignedReviewerId) return false;
    if (query.unassigned && assignment) return false;
    if (query.department && transaction.department?.toLowerCase() !== query.department.toLowerCase()) return false;
    if (query.expenseCategory && transaction.expenseCategory?.toLowerCase() !== query.expenseCategory.toLowerCase()) return false;
    if (query.dateFrom && String(transaction.invoiceDate ?? "") < query.dateFrom) return false;
    if (query.dateTo && String(transaction.invoiceDate ?? "") > query.dateTo) return false;
    if (query.amountMin !== undefined && (typeof transaction.amount !== "number" || transaction.amount < query.amountMin)) return false;
    if (query.amountMax !== undefined && (typeof transaction.amount !== "number" || transaction.amount > query.amountMax)) return false;
    if (query.duplicateType && !duplicateMatches.some(({ matchType }) => matchType === query.duplicateType)) return false;
    if (query.reviewStatus === "REVIEWED" && !review) return false;
    if (query.reviewStatus === "UNREVIEWED" && review) return false;
    if (query.ageBucket && !inAgeBucket(ageInDays(transaction.createdAt, now), query.ageBucket)) return false;
    return true;
  }).sort((left, right) => compareItems(left, right, query));

  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const pageSize = Math.min(MAX_SERVER_PAGE_SIZE, Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_SERVER_PAGE_SIZE)));
  const totalItems = filtered.length;
  const offset = (page - 1) * pageSize;
  return {
    items: filtered.slice(offset, offset + pageSize),
    page,
    pageSize,
    totalItems,
    totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
  };
}

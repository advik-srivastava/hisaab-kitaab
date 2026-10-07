import type { DuplicateMatch } from "../../types/duplicates";
import type { RuleResult } from "../../types/rules";
import type { Transaction } from "../../types/transaction";
import type { ExceptionsPageQuery, StoredReviewAction } from "./types";

export interface ExceptionFilterEvidence {
  duplicateMatches?: readonly DuplicateMatch[];
  failedRules?: readonly RuleResult[];
  reviewActions?: readonly StoredReviewAction[];
}

function normalized(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase("en-IN") ?? "";
}

function sameText(value: string | null | undefined, expected: string | undefined): boolean {
  return !expected || normalized(value) === normalized(expected);
}

export function hasAdvancedExceptionFilters(query: ExceptionsPageQuery): boolean {
  return Boolean(
    query.search?.trim()
    || query.expenseCategory
    || query.currency
    || query.department
    || query.amountMin !== undefined
    || query.amountMax !== undefined
    || query.dateFrom
    || query.dateTo
    || query.duplicateType
    || query.purchaseOrderState
    || query.reviewStatus
    || query.quickFilter,
  );
}

export function matchesExceptionQuery(
  transaction: Transaction,
  query: ExceptionsPageQuery,
  evidence: ExceptionFilterEvidence = {},
): boolean {
  const search = normalized(query.search);
  if (search) {
    const searchable = [
      transaction.invoiceNumber,
      transaction.vendorName,
      transaction.id,
      transaction.purchaseOrder,
      transaction.employeeId,
      transaction.department,
      transaction.expenseCategory,
      transaction.description,
    ].map(normalized).filter(Boolean).join(" ");
    if (!searchable.includes(search)) return false;
  }
  if (!sameText(transaction.expenseCategory, query.expenseCategory)) return false;
  if (!sameText(transaction.currency, query.currency)) return false;
  if (!sameText(transaction.department, query.department)) return false;

  const amount = transaction.amount;
  if (query.amountMin !== undefined && (typeof amount !== "number" || amount < query.amountMin)) return false;
  if (query.amountMax !== undefined && (typeof amount !== "number" || amount > query.amountMax)) return false;
  const invoiceDate = transaction.invoiceDate?.trim();
  if (query.dateFrom && (!invoiceDate || invoiceDate < query.dateFrom)) return false;
  if (query.dateTo && (!invoiceDate || invoiceDate > query.dateTo)) return false;

  const purchaseOrderPresent = Boolean(transaction.purchaseOrder?.trim());
  if (query.purchaseOrderState === "PRESENT" && !purchaseOrderPresent) return false;
  if (query.purchaseOrderState === "MISSING" && purchaseOrderPresent) return false;

  const duplicates = evidence.duplicateMatches ?? [];
  if (query.duplicateType === "NONE" && duplicates.length > 0) return false;
  if (query.duplicateType && query.duplicateType !== "NONE"
    && !duplicates.some(({ matchType }) => matchType === query.duplicateType)) return false;

  const reviewed = (evidence.reviewActions?.length ?? 0) > 0;
  if (query.reviewStatus === "REVIEWED" && !reviewed) return false;
  if (query.reviewStatus === "UNREVIEWED" && reviewed) return false;

  if (query.quickFilter === "DUPLICATE" && duplicates.length === 0) return false;
  const failedRules = evidence.failedRules ?? [];
  if (query.quickFilter === "AMOUNT_VIOLATION"
    && !failedRules.some(({ ruleId }) => ruleId.startsWith("LIMIT_"))) return false;
  if (query.quickFilter === "MISSING_PO"
    && !failedRules.some(({ ruleId }) => ruleId === "PO_REQUIRED")) return false;
  return true;
}

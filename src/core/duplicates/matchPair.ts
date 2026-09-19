import type { DuplicateMatch } from "../../types/duplicates";
import type { Transaction } from "../../types/transaction";
import {
  comparableInvoiceNumber,
  comparableVendor,
  currenciesCompatible,
  dateDifferenceDays,
  formatRupees,
  validAmount,
  vendorSimilarity,
} from "./helpers";

function baseEvidence(matchedTransactionId: string): string[] {
  return [`Potential duplicate detected with ${matchedTransactionId}.`];
}

export function findDuplicateForPair(
  current: Transaction,
  matched: Transaction,
): DuplicateMatch | undefined {
  if (current.id === matched.id) {
    return undefined;
  }

  const currentVendor = comparableVendor(current.normalizedVendor);
  const matchedVendor = comparableVendor(matched.normalizedVendor);
  const currentInvoice = comparableInvoiceNumber(current.invoiceNumber);
  const matchedInvoice = comparableInvoiceNumber(matched.invoiceNumber);
  const sameVendor =
    currentVendor !== undefined &&
    matchedVendor !== undefined &&
    currentVendor === matchedVendor;
  const invoiceNumberMatch =
    currentInvoice !== undefined &&
    matchedInvoice !== undefined &&
    currentInvoice === matchedInvoice;

  const currentAmount = validAmount(current);
  const matchedAmount = validAmount(matched);
  const amountMatch =
    currentAmount !== undefined &&
    matchedAmount !== undefined &&
    currentAmount === matchedAmount;
  const daysApart = dateDifferenceDays(current, matched);

  if (sameVendor && invoiceNumberMatch) {
    const evidence = [
      ...baseEvidence(matched.id),
      `Same normalized vendor: ${currentVendor}.`,
      `Same invoice number: ${current.invoiceNumber!.trim()}.`,
    ];
    if (amountMatch) {
      evidence.push(`Same amount: ${formatRupees(currentAmount!)}.`);
    }

    return {
      currentTransactionId: current.id,
      matchedTransactionId: matched.id,
      matchType: "EXACT",
      vendorSimilarity: 100,
      amountMatch,
      invoiceNumberMatch: true,
      dateDifferenceDays: daysApart ?? null,
      confidenceBand: "HIGH",
      evidence,
    };
  }

  const candidateEligible =
    amountMatch &&
    daysApart !== undefined &&
    daysApart <= 3 &&
    currenciesCompatible(current, matched);
  if (!candidateEligible) {
    return undefined;
  }

  if (sameVendor) {
    return {
      currentTransactionId: current.id,
      matchedTransactionId: matched.id,
      matchType: "PROBABLE",
      vendorSimilarity: 100,
      amountMatch: true,
      invoiceNumberMatch,
      dateDifferenceDays: daysApart,
      confidenceBand: "HIGH",
      evidence: [
        ...baseEvidence(matched.id),
        `Same normalized vendor: ${currentVendor}.`,
        `Same amount: ${formatRupees(currentAmount!)}.`,
        `Invoice dates are ${daysApart} ${daysApart === 1 ? "day" : "days"} apart.`,
      ],
    };
  }

  if (!currentVendor || !matchedVendor) {
    return undefined;
  }

  const similarity = vendorSimilarity(currentVendor, matchedVendor);
  if (similarity < 90) {
    return undefined;
  }

  const roundedSimilarity = Math.round(similarity);
  return {
    currentTransactionId: current.id,
    matchedTransactionId: matched.id,
    matchType: "FUZZY",
    vendorSimilarity: roundedSimilarity,
    amountMatch: true,
    invoiceNumberMatch,
    dateDifferenceDays: daysApart,
    confidenceBand: "MEDIUM",
    evidence: [
      ...baseEvidence(matched.id),
      `Vendor similarity: ${roundedSimilarity}%.`,
      `Same amount: ${formatRupees(currentAmount!)}.`,
      `Invoice dates are ${daysApart} ${daysApart === 1 ? "day" : "days"} apart.`,
    ],
  };
}

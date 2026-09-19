import type { DuplicateMatch } from "../../types/duplicates";
import type { Transaction } from "../../types/transaction";
import {
  comparableInvoiceNumber,
  comparableVendor,
  currenciesCompatible,
  dateDifferenceDays,
  validAmount,
} from "./helpers";
import { findDuplicateForPair } from "./matchPair";
import type { DuplicateDetectionMetrics } from "./types";

function addGroupPairs(indexes: readonly number[], pairs: Set<string>): void {
  for (let first = 0; first < indexes.length; first += 1) {
    for (let second = first + 1; second < indexes.length; second += 1) {
      pairs.add(`${indexes[first]}:${indexes[second]}`);
    }
  }
}

function addToGroup(
  groups: Map<string, number[]>,
  key: string,
  index: number,
): void {
  const group = groups.get(key);
  if (group) group.push(index);
  else groups.set(key, [index]);
}

export function findDuplicates(
  transactions: readonly Transaction[],
  metrics?: DuplicateDetectionMetrics,
): DuplicateMatch[] {
  const ordered = [...transactions].sort((first, second) => {
    if (first.id < second.id) return -1;
    if (first.id > second.id) return 1;
    return 0;
  });
  const matches: DuplicateMatch[] = [];
  const candidatePairs = new Set<string>();
  const exactGroups = new Map<string, number[]>();
  const amountGroups = new Map<number, number[]>();

  ordered.forEach((transaction, index) => {
    const vendor = comparableVendor(transaction.normalizedVendor);
    const invoice = comparableInvoiceNumber(transaction.invoiceNumber);
    if (vendor && invoice) addToGroup(exactGroups, `${vendor}\u0000${invoice}`, index);

    const amount = validAmount(transaction);
    if (amount !== undefined) {
      const group = amountGroups.get(amount);
      if (group) group.push(index);
      else amountGroups.set(amount, [index]);
    }
  });

  for (const indexes of exactGroups.values()) addGroupPairs(indexes, candidatePairs);

  for (const indexes of amountGroups.values()) {
    for (let first = 0; first < indexes.length; first += 1) {
      for (let second = first + 1; second < indexes.length; second += 1) {
        const firstIndex = indexes[first];
        const secondIndex = indexes[second];
        const firstTransaction = ordered[firstIndex];
        const secondTransaction = ordered[secondIndex];
        const daysApart = dateDifferenceDays(firstTransaction, secondTransaction);
        if (
          daysApart !== undefined &&
          daysApart <= 3 &&
          currenciesCompatible(firstTransaction, secondTransaction)
        ) {
          candidatePairs.add(`${firstIndex}:${secondIndex}`);
        }
      }
    }
  }

  const orderedPairs = [...candidatePairs]
    .map((pair) => pair.split(":").map(Number) as [number, number])
    .sort(([firstA, secondA], [firstB, secondB]) =>
      firstA === firstB ? secondA - secondB : firstA - firstB,
    );

  if (metrics) {
    metrics.totalTransactions = ordered.length;
    metrics.candidatePairs = orderedPairs.length;
    metrics.evaluatedPairs = 0;
    metrics.fuzzyComparisons = 0;
  }

  for (const [currentIndex, matchedIndex] of orderedPairs) {
    if (metrics) metrics.evaluatedPairs += 1;
    const match = findDuplicateForPair(
      ordered[currentIndex],
      ordered[matchedIndex],
      metrics,
    );
    if (match) matches.push(match);
  }

  return matches;
}

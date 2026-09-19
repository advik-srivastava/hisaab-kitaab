import type { DuplicateMatch } from "../../types/duplicates";
import type { Transaction } from "../../types/transaction";
import { findDuplicateForPair } from "./matchPair";

export function findDuplicates(
  transactions: readonly Transaction[],
): DuplicateMatch[] {
  const ordered = [...transactions].sort((first, second) => {
    if (first.id < second.id) return -1;
    if (first.id > second.id) return 1;
    return 0;
  });
  const matches: DuplicateMatch[] = [];

  for (let currentIndex = 0; currentIndex < ordered.length; currentIndex += 1) {
    for (
      let matchedIndex = currentIndex + 1;
      matchedIndex < ordered.length;
      matchedIndex += 1
    ) {
      const match = findDuplicateForPair(
        ordered[currentIndex],
        ordered[matchedIndex],
      );
      if (match) {
        matches.push(match);
      }
    }
  }

  return matches;
}

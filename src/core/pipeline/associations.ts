import type { DuplicateMatch } from "../../types/duplicates";
import type { Transaction } from "../../types/transaction";

function mirrorMatch(match: DuplicateMatch): DuplicateMatch {
  return {
    ...match,
    currentTransactionId: match.matchedTransactionId,
    matchedTransactionId: match.currentTransactionId,
    evidence: match.evidence.map((fact) =>
      fact.replace(match.matchedTransactionId, match.currentTransactionId),
    ),
  };
}

export function associateDuplicateMatches(
  transactions: readonly Transaction[],
  pairs: readonly DuplicateMatch[],
): Record<string, DuplicateMatch[]> {
  const associations = Object.fromEntries(
    transactions.map(({ id }) => [id, [] as DuplicateMatch[]]),
  );

  for (const match of pairs) {
    associations[match.currentTransactionId]?.push(match);
    associations[match.matchedTransactionId]?.push(mirrorMatch(match));
  }

  const precedence = { EXACT: 0, PROBABLE: 1, FUZZY: 2 } as const;
  for (const matches of Object.values(associations)) {
    matches.sort(
      (first, second) =>
        precedence[first.matchType] - precedence[second.matchType],
    );
  }

  return associations;
}

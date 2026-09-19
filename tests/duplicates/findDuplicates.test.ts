import { describe, expect, it } from "vitest";

import { findDuplicates } from "../../src/core/duplicates";
import { duplicateMatchSchema } from "../../src/types/duplicates";
import type { Transaction } from "../../src/types/transaction";

const baseTransaction: Transaction = {
  id: "TXN-001",
  batchId: "batch-1",
  vendorName: "Contoso Consulting Pvt Ltd",
  normalizedVendor: "contoso consulting pvt ltd",
  invoiceNumber: "INV-001",
  invoiceDate: "2026-09-10",
  amount: 18500,
  currency: "INR",
  expenseCategory: "Consulting",
  employeeId: undefined,
  department: "Finance",
  purchaseOrder: "PO-1",
  description: undefined,
  sourceFile: "transactions.csv",
  sourceSheet: "CSV",
  sourceRow: 2,
  createdAt: "2026-09-19T00:00:00.000Z",
};

function transaction(
  id: string,
  overrides: Partial<Transaction> = {},
): Transaction {
  return { ...baseTransaction, id, ...overrides };
}

describe("exact duplicate detection", () => {
  it("detects an exact duplicate", () => {
    const matches = findDuplicates([
      transaction("TXN-001"),
      transaction("TXN-002", { invoiceNumber: " inv-001 " }),
    ]);

    expect(matches).toHaveLength(1);
    expect(matches[0].matchType).toBe("EXACT");
  });

  it("populates matchedTransactionId", () => {
    const [match] = findDuplicates([
      transaction("TXN-001"),
      transaction("TXN-009"),
    ]);

    expect(match).toMatchObject({
      currentTransactionId: "TXN-001",
      matchedTransactionId: "TXN-009",
    });
  });

  it("does not exact-match the same invoice for different vendors", () => {
    const matches = findDuplicates([
      transaction("TXN-001"),
      transaction("TXN-002", {
        vendorName: "Fabrikam",
        normalizedVendor: "fabrikam",
      }),
    ]);

    expect(matches.some(({ matchType }) => matchType === "EXACT")).toBe(false);
  });

  it("does not exact-match the same vendor with different invoices", () => {
    const matches = findDuplicates([
      transaction("TXN-001"),
      transaction("TXN-002", { invoiceNumber: "INV-002" }),
    ]);

    expect(matches.some(({ matchType }) => matchType === "EXACT")).toBe(false);
  });

  it("does not exact-match missing vendors", () => {
    const matches = findDuplicates([
      transaction("TXN-001", { normalizedVendor: undefined }),
      transaction("TXN-002", { normalizedVendor: " " }),
    ]);

    expect(matches).toEqual([]);
  });

  it("does not exact-match missing invoice numbers", () => {
    const matches = findDuplicates([
      transaction("TXN-001", { invoiceNumber: undefined }),
      transaction("TXN-002", { invoiceNumber: " " }),
    ]);

    expect(matches.some(({ matchType }) => matchType === "EXACT")).toBe(false);
  });

  it("never matches a transaction with itself", () => {
    expect(findDuplicates([transaction("TXN-001")])).toEqual([]);
    expect(
      findDuplicates([transaction("TXN-001"), transaction("TXN-001")]),
    ).toEqual([]);
  });
});

describe("probable duplicate detection", () => {
  it("detects a probable duplicate", () => {
    const [match] = findDuplicates([
      transaction("TXN-001"),
      transaction("TXN-002", {
        invoiceNumber: "INV-002",
        invoiceDate: "2026-09-12",
      }),
    ]);

    expect(match).toMatchObject({
      matchType: "PROBABLE",
      amountMatch: true,
      dateDifferenceDays: 2,
    });
  });

  it("matches at the three-day boundary", () => {
    const [match] = findDuplicates([
      transaction("TXN-001"),
      transaction("TXN-002", {
        invoiceNumber: "INV-002",
        invoiceDate: "2026-09-13",
      }),
    ]);

    expect(match).toMatchObject({ matchType: "PROBABLE", dateDifferenceDays: 3 });
  });

  it("does not match dates four days apart", () => {
    expect(
      findDuplicates([
        transaction("TXN-001"),
        transaction("TXN-002", {
          invoiceNumber: "INV-002",
          invoiceDate: "2026-09-14",
        }),
      ]),
    ).toEqual([]);
  });

  it("does not match different amounts", () => {
    expect(
      findDuplicates([
        transaction("TXN-001"),
        transaction("TXN-002", { invoiceNumber: "INV-002", amount: 19000 }),
      ]),
    ).toEqual([]);
  });

  it.each([undefined, null, 0, -10, Number.NaN])(
    "does not use invalid amount %s as a duplicate basis",
    (amount) => {
      expect(
        findDuplicates([
          transaction("TXN-001", { amount }),
          transaction("TXN-002", { invoiceNumber: "INV-002", amount }),
        ]),
      ).toEqual([]);
    },
  );

  it.each([undefined, "not-a-date", "2026-02-30"])(
    "does not match invalid date %s",
    (invoiceDate) => {
      expect(
        findDuplicates([
          transaction("TXN-001", { invoiceDate }),
          transaction("TXN-002", { invoiceNumber: "INV-002", invoiceDate }),
        ]),
      ).toEqual([]);
    },
  );

  it("does not match equal numeric amounts in different currencies", () => {
    expect(
      findDuplicates([
        transaction("TXN-001", { currency: "INR" }),
        transaction("TXN-002", { invoiceNumber: "INV-002", currency: "USD" }),
      ]),
    ).toEqual([]);
  });
});

describe("fuzzy duplicate detection", () => {
  it("detects a vendor similarity of at least 90", () => {
    const [match] = findDuplicates([
      transaction("TXN-001"),
      transaction("TXN-002", {
        normalizedVendor: "contoso consultng pvt ltd",
        invoiceNumber: "INV-002",
      }),
    ]);

    expect(match.matchType).toBe("FUZZY");
    expect(match.vendorSimilarity).toBeGreaterThanOrEqual(90);
  });

  it("matches Pvt Ltd and Private Limited vendor forms", () => {
    const [match] = findDuplicates([
      transaction("TXN-001", {
        vendorName: "Microsoft India Pvt Ltd",
        normalizedVendor: "microsoft india pvt ltd",
      }),
      transaction("TXN-002", {
        vendorName: "Microsoft India Private Limited",
        normalizedVendor: "microsoft india private limited",
        invoiceNumber: "INV-002",
      }),
    ]);

    expect(match).toMatchObject({ matchType: "FUZZY", vendorSimilarity: 100 });
  });

  it("does not fuzzy-match a different amount", () => {
    expect(
      findDuplicates([
        transaction("TXN-001"),
        transaction("TXN-002", {
          normalizedVendor: "contoso consultng pvt ltd",
          invoiceNumber: "INV-002",
          amount: 18000,
        }),
      ]),
    ).toEqual([]);
  });

  it("does not fuzzy-match dates beyond three days", () => {
    expect(
      findDuplicates([
        transaction("TXN-001"),
        transaction("TXN-002", {
          normalizedVendor: "contoso consultng pvt ltd",
          invoiceNumber: "INV-002",
          invoiceDate: "2026-09-20",
        }),
      ]),
    ).toEqual([]);
  });

  it("does not match unrelated vendors with the same amount and date", () => {
    expect(
      findDuplicates([
        transaction("TXN-001"),
        transaction("TXN-002", {
          normalizedVendor: "northwind traders ltd",
          invoiceNumber: "INV-002",
        }),
      ]),
    ).toEqual([]);
  });

  it("does not fuzzy-match incompatible currencies", () => {
    expect(
      findDuplicates([
        transaction("TXN-001", { currency: "INR" }),
        transaction("TXN-002", {
          normalizedVendor: "contoso consultng pvt ltd",
          invoiceNumber: "INV-002",
          currency: "USD",
        }),
      ]),
    ).toEqual([]);
  });
});

describe("match precedence and result data", () => {
  it("returns only EXACT when exact, probable, and fuzzy conditions apply", () => {
    const matches = findDuplicates([
      transaction("TXN-001"),
      transaction("TXN-002"),
    ]);

    expect(matches).toHaveLength(1);
    expect(matches[0].matchType).toBe("EXACT");
  });

  it("returns PROBABLE instead of FUZZY for the same normalized vendor", () => {
    const matches = findDuplicates([
      transaction("TXN-001"),
      transaction("TXN-002", { invoiceNumber: "INV-002" }),
    ]);

    expect(matches).toHaveLength(1);
    expect(matches[0].matchType).toBe("PROBABLE");
  });

  it("returns an A-B pair only once and in deterministic ID order", () => {
    const matches = findDuplicates([
      transaction("TXN-002"),
      transaction("TXN-001"),
    ]);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      currentTransactionId: "TXN-001",
      matchedTransactionId: "TXN-002",
    });
  });

  it("returns multiple independent pairs", () => {
    const matches = findDuplicates([
      transaction("TXN-001"),
      transaction("TXN-002"),
      transaction("TXN-003", {
        normalizedVendor: "fabrikam ltd",
        invoiceNumber: "FAB-1",
        amount: 9000,
      }),
      transaction("TXN-004", {
        normalizedVendor: "fabrikam ltd",
        invoiceNumber: "FAB-2",
        amount: 9000,
        invoiceDate: "2026-09-11",
      }),
    ]);

    expect(matches.map(({ matchType }) => matchType)).toEqual(["EXACT", "PROBABLE"]);
  });

  it("populates amountMatch accurately for exact matches", () => {
    const [match] = findDuplicates([
      transaction("TXN-001"),
      transaction("TXN-002", { amount: 999 }),
    ]);

    expect(match).toMatchObject({ matchType: "EXACT", amountMatch: false });
  });

  it("populates the absolute calendar-day difference", () => {
    const [match] = findDuplicates([
      transaction("TXN-001", { invoiceDate: "2026-09-12" }),
      transaction("TXN-002", {
        invoiceNumber: "INV-002",
        invoiceDate: "2026-09-10",
      }),
    ]);

    expect(match.dateDifferenceDays).toBe(2);
  });

  it("uses supported confidence bands for all match types", () => {
    const exact = findDuplicates([
      transaction("EXACT-1"),
      transaction("EXACT-2"),
    ])[0];
    const probable = findDuplicates([
      transaction("PROBABLE-1"),
      transaction("PROBABLE-2", { invoiceNumber: "INV-2" }),
    ])[0];
    const fuzzy = findDuplicates([
      transaction("FUZZY-1"),
      transaction("FUZZY-2", {
        normalizedVendor: "contoso consultng pvt ltd",
        invoiceNumber: "INV-2",
      }),
    ])[0];

    expect(exact.confidenceBand).toBe("HIGH");
    expect(probable.confidenceBand).toBe("HIGH");
    expect(fuzzy.confidenceBand).toBe("MEDIUM");
  });

  it("provides deterministic matched-record evidence", () => {
    const [match] = findDuplicates([
      transaction("TXN-001"),
      transaction("TXN-009", {
        normalizedVendor: "contoso consultng pvt ltd",
        invoiceNumber: "INV-009",
        invoiceDate: "2026-09-11",
      }),
    ]);

    expect(match.evidence).toEqual([
      "Potential duplicate detected with TXN-009.",
      `Vendor similarity: ${match.vendorSimilarity}%.`,
      "Same amount: ₹18,500.",
      "Invoice dates are 1 day apart.",
    ]);
    expect(duplicateMatchSchema.safeParse(match).success).toBe(true);
  });
});

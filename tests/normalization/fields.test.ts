import { describe, expect, it } from "vitest";

import {
  normalizeAmount,
  normalizeCurrency,
  normalizeDate,
  normalizeInvoiceNumber,
  normalizeText,
  normalizeVendor,
} from "../../src/core/normalization";

describe("field normalization", () => {
  it("normalizes a numeric amount", () => {
    expect(normalizeAmount(18500)).toBe(18500);
  });

  it.each([
    ["18,500", 18500],
    ["₹18,500", 18500],
    ["₹ 18,500", 18500],
    ["18500.50", 18500.5],
  ])("normalizes amount %s", (input, expected) => {
    expect(normalizeAmount(input)).toBe(expected);
  });

  it.each(["abc", "₹xyz", ""])("does not coerce invalid amount %s to zero", (input) => {
    expect(normalizeAmount(input)).toBeUndefined();
  });

  it("normalizes valid dates to ISO date strings", () => {
    expect(normalizeDate("19/09/2026")).toBe("2026-09-19");
    expect(normalizeDate(new Date("2026-09-19T12:00:00.000Z"))).toBe("2026-09-19");
    expect(normalizeDate(46384)).toBe("2026-12-28");
  });

  it("preserves invalid date text for later validation", () => {
    expect(normalizeDate("not-a-date")).toBe("not-a-date");
  });

  it("uppercases currency", () => {
    expect(normalizeCurrency(" inr ")).toBe("INR");
  });

  it.each([
    "Microsoft India Pvt Ltd",
    "Microsoft India Private Limited",
    "Microsoft India Pvt. Ltd.",
  ])("canonicalizes vendor %s", (vendor) => {
    expect(normalizeVendor(vendor)).toBe("microsoft india pvt ltd");
  });

  it("trims and collapses text without altering invoice punctuation", () => {
    expect(normalizeText("  Taxi   receipt  ")).toBe("Taxi receipt");
    expect(normalizeInvoiceNumber(" INV /  2026-01 ")).toBe("INV / 2026-01");
  });

  it("turns blank text into undefined", () => {
    expect(normalizeText("   ")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import {
  formatCurrency,
  formatIndianCompactCurrency,
  formatIndianNumber,
  formatINR,
} from "../../src/lib/formatting";

describe("Indian financial formatting", () => {
  it.each([
    [100000, "1,00,000"],
    [245820, "2,45,820"],
    [1250000, "12,50,000"],
  ])("formats %i with Indian grouping", (value, expected) => {
    expect(formatIndianNumber(value)).toBe(expected);
  });

  it("formats INR precisely with Indian grouping", () => {
    expect(formatINR(245820)).toBe("₹2,45,820");
  });

  it("preserves non-INR currency identity", () => {
    expect(formatCurrency(125000, "USD")).toBe("USD 1,25,000");
  });

  it.each([
    [100000, "₹1L"],
    [550000, "₹5.5L"],
    [10000000, "₹1Cr"],
    [12500000, "₹1.25Cr"],
  ])("formats dashboard compact value %i", (value, expected) => {
    expect(formatIndianCompactCurrency(value)).toBe(expected);
  });
});

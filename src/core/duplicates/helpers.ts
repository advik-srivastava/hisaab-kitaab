import { fuzzy } from "fast-fuzzy";

import type { Transaction } from "../../types/transaction";
import { formatCurrency } from "../../lib/formatting";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function comparableVendor(value: string | null | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized || undefined;
}

export function comparableInvoiceNumber(
  value: string | null | undefined,
): string | undefined {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized || undefined;
}

function fuzzyVendorValue(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (word === "private") return "pvt";
      if (word === "limited") return "ltd";
      return word;
    })
    .join(" ");
}

export function vendorSimilarity(
  first: string,
  second: string,
): number {
  return fuzzy(fuzzyVendorValue(first), fuzzyVendorValue(second)) * 100;
}

export function validAmount(transaction: Transaction): number | undefined {
  const amount = transaction.amount;
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0
    ? amount
    : undefined;
}

export function currenciesCompatible(
  first: Transaction,
  second: Transaction,
): boolean {
  const firstCurrency = first.currency?.trim().toUpperCase();
  const secondCurrency = second.currency?.trim().toUpperCase();
  return !firstCurrency || !secondCurrency || firstCurrency === secondCurrency;
}

function parseDate(value: string | null | undefined): number | undefined {
  const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return timestamp;
}

export function dateDifferenceDays(
  first: Transaction,
  second: Transaction,
): number | undefined {
  const firstDate = parseDate(first.invoiceDate);
  const secondDate = parseDate(second.invoiceDate);
  if (firstDate === undefined || secondDate === undefined) {
    return undefined;
  }

  return Math.abs(firstDate - secondDate) / DAY_IN_MILLISECONDS;
}

export function formatRupees(amount: number, currency = "INR"): string {
  return formatCurrency(amount, currency);
}

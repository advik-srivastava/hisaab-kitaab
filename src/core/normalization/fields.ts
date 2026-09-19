import { SSF } from "xlsx";

export function normalizeText(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim().replace(/\s+/g, " ");
  return normalized || undefined;
}

export function normalizeCurrency(value: unknown): string | undefined {
  return normalizeText(value)?.toUpperCase();
}

export function normalizeInvoiceNumber(value: unknown): string | undefined {
  return normalizeText(value);
}

export function normalizeAmount(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  const text = normalizeText(value);
  if (!text) {
    return undefined;
  }

  const numericText = text.replace(/₹/g, "").replace(/[\s,]/g, "");
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(numericText)) {
    return undefined;
  }

  const amount = Number(numericText);
  return Number.isFinite(amount) ? amount : undefined;
}

function formatDate(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return date.toISOString().slice(0, 10);
}

export function normalizeDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? String(value)
      : value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsed = SSF.parse_date_code(value);
    return parsed
      ? formatDate(parsed.y, parsed.m, parsed.d)
      : String(value);
  }

  const text = normalizeText(value);
  if (!text) {
    return undefined;
  }

  const yearFirst = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\D.*)?$/);
  if (yearFirst) {
    return (
      formatDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3])) ??
      text
    );
  }

  const dayFirst = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dayFirst) {
    return (
      formatDate(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1])) ??
      text
    );
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime())
    ? text
    : parsed.toISOString().slice(0, 10);
}

export function normalizeVendor(value: unknown): string | undefined {
  const vendor = normalizeText(value);
  if (!vendor) {
    return undefined;
  }

  const words = vendor
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (word === "private") return "pvt";
      if (word === "limited") return "ltd";
      return word;
    });

  return words.join(" ") || undefined;
}

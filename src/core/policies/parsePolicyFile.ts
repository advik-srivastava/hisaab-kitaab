import * as XLSX from "xlsx";
import {
  financePolicySchema,
  financePolicyUploadSchema,
  type FinancePolicy,
} from "../../types/policies";

type PolicyInput = Partial<FinancePolicy> & Record<string, unknown>;

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function textOrNumber(value: unknown): string | undefined {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : text(value);
}

function number(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return text(value)?.split(/[|,;]/).map((item) => item.trim()).filter(Boolean) ?? [];
}

function expenseLimits(input: PolicyInput): Record<string, number> {
  if (input.expenseLimits && typeof input.expenseLimits === "object" && !Array.isArray(input.expenseLimits)) {
    return Object.fromEntries(Object.entries(input.expenseLimits).flatMap(([category, value]) => {
      const parsed = number(value);
      return parsed === undefined ? [] : [[category.trim(), parsed]];
    }));
  }
  if (typeof input.expenseLimits === "string") {
    try {
      return expenseLimits({ expenseLimits: JSON.parse(input.expenseLimits) });
    } catch {
      return {};
    }
  }
  return Object.fromEntries(Object.entries(input).flatMap(([key, value]) => {
    if (!key.toLowerCase().startsWith("expenselimit.")) return [];
    const parsed = number(value);
    const category = key.slice(key.indexOf(".") + 1).trim();
    return parsed === undefined || !category ? [] : [[category, parsed]];
  }));
}

function normalizePolicyInput(
  input: PolicyInput,
  now: string,
  id: string,
): FinancePolicy {
  const businessConfiguration = financePolicyUploadSchema.parse({
    companyName: text(input.companyName),
    policyName: text(input.policyName),
    version: textOrNumber(input.version),
    supportedCurrencies: stringList(input.supportedCurrencies).map((currency) => currency.toUpperCase()),
    expenseLimits: expenseLimits(input),
    purchaseOrderRequiredAbove: number(input.purchaseOrderRequiredAbove),
    requiredFields: input.requiredFields === undefined ? undefined : stringList(input.requiredFields),
  });
  return financePolicySchema.parse({
    ...businessConfiguration,
    id,
    createdAt: now,
    status: "DRAFT",
  });
}

function generatedId(now: string): string {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : now.replaceAll(/\D/g, "");
  return `policy-${suffix}`;
}

export async function parsePolicyFile(
  file: File,
  options: { now?: string; id?: string } = {},
): Promise<FinancePolicy> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const now = options.now ?? new Date().toISOString();
  const id = options.id ?? generatedId(now);
  let input: PolicyInput;

  if (extension === "json") {
    try {
      input = JSON.parse(await file.text()) as PolicyInput;
    } catch {
      throw new Error("The JSON policy file is malformed.");
    }
  } else if (extension === "csv" || extension === "xlsx") {
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) throw new Error("empty");
      const rows = XLSX.utils.sheet_to_json<PolicyInput>(workbook.Sheets[firstSheet], { defval: "" });
      if (!rows[0]) throw new Error("empty");
      input = rows[0];
    } catch {
      throw new Error(`The ${extension.toUpperCase()} policy file could not be read.`);
    }
  } else {
    throw new Error("Unsupported policy file. Select JSON, CSV, or XLSX.");
  }

  return normalizePolicyInput(input, now, id);
}

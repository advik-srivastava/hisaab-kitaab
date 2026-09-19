const aliases = {
  vendorName: ["Vendor", "Vendor Name", "Supplier"],
  invoiceNumber: ["Invoice", "Invoice No", "Invoice Number", "Invoice #"],
  invoiceDate: ["Invoice Date", "Date"],
  amount: ["Value", "Total", "Amount", "Invoice Amount"],
  currency: ["Currency", "Curr"],
  expenseCategory: ["Category", "Expense Category"],
  employeeId: ["Employee", "Employee ID"],
  department: ["Department", "Dept"],
  purchaseOrder: ["PO", "PO Number", "Purchase Order"],
  description: ["Description", "Details", "Memo"],
} as const;

export type CanonicalField = keyof typeof aliases;

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const aliasLookup = new Map<string, CanonicalField>();

for (const [field, fieldAliases] of Object.entries(aliases) as [
  CanonicalField,
  readonly string[],
][]) {
  for (const alias of fieldAliases) {
    aliasLookup.set(normalizeHeader(alias), field);
  }
}

export function mapHeaders(headers: unknown[]): Array<CanonicalField | undefined> {
  return headers.map((header) => aliasLookup.get(normalizeHeader(header)));
}

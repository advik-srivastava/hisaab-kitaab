const indianNumberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

function finiteValue(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function formatIndianNumber(value: number): string {
  return indianNumberFormatter.format(finiteValue(value));
}

export function formatCurrency(value: number, currency = "INR"): string {
  const normalizedCurrency = currency.trim().toUpperCase() || "INR";
  if (normalizedCurrency === "INR") return `₹${formatIndianNumber(value)}`;
  return `${normalizedCurrency} ${formatIndianNumber(value)}`;
}

export function formatINR(value: number): string {
  return formatCurrency(value, "INR");
}

export function formatIndianCompactCurrency(value: number): string {
  const amount = finiteValue(value);
  const absolute = Math.abs(amount);
  if (absolute >= 10_000_000) return `₹${formatIndianNumber(amount / 10_000_000)}Cr`;
  if (absolute >= 100_000) return `₹${formatIndianNumber(amount / 100_000)}L`;
  return formatINR(amount);
}

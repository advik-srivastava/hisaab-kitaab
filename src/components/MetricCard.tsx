import { formatIndianCompactCurrency, formatIndianNumber } from "@/lib/formatting";

export function MetricCard({
  title,
  value,
  isCurrency = false,
}: {
  title: string;
  value: string | number;
  isCurrency?: boolean;
}) {
  return (
    <div className="card card-hoverable p-6 flex flex-col justify-between">
      <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">{title}</h3>
      <p className="mt-3 text-3xl font-bold text-text-primary tracking-tight">
        {isCurrency && typeof value === "number"
          ? formatIndianCompactCurrency(value)
          : typeof value === "number"
            ? formatIndianNumber(value)
            : value}
      </p>
    </div>
  );
}

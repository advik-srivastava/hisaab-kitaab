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
    <div className="card p-6 flex flex-col justify-between group hover:border-brand-primary/30 relative overflow-hidden transition-all duration-[320ms] ease-[cubic-bezier(.22,1,.36,1)] hover:shadow-md">
      <div className="absolute top-0 left-0 w-full h-1 bg-brand-primary/0 group-hover:bg-brand-primary/80 transition-colors duration-[320ms]"></div>
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

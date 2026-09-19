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
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
      <h3 className="text-sm font-medium text-slate-500">{title}</h3>
      <p className="mt-2 text-3xl font-semibold text-slate-900">
        {isCurrency ? `₹${value.toLocaleString()}` : value}
      </p>
    </div>
  );
}

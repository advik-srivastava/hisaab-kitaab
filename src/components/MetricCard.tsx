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
    <div className="bg-white rounded-xl border border-slate-200/75 p-6 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
      <h3 className="text-sm font-medium text-slate-600">{title}</h3>
      <p className="mt-3 text-3xl font-semibold text-slate-900 tracking-tight">
        {isCurrency ? `₹${value.toLocaleString()}` : value}
      </p>
    </div>
  );
}

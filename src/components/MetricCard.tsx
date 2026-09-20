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
    <div className="card p-6 flex flex-col justify-between group hover:border-panel-border-hover relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-brand-primary/0 group-hover:bg-brand-primary/50 transition-colors duration-300"></div>
      <h3 className="text-sm font-semibold text-text-secondary">{title}</h3>
      <p className="mt-3 text-3xl font-bold text-text-primary tracking-tight group-hover:text-white transition-colors duration-300">
        {isCurrency ? `₹${value.toLocaleString()}` : value}
      </p>
    </div>
  );
}

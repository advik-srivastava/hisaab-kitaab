import { DecisionStatus } from "@/types/decisions";

export function StatusBadge({ status }: { status: DecisionStatus }) {
  const styles = {
    AUTO_PASS: "bg-emerald-50 text-emerald-700 border-emerald-200/60 ring-1 ring-inset ring-emerald-600/10",
    REVIEW: "bg-amber-50 text-amber-700 border-amber-200/60 ring-1 ring-inset ring-amber-600/10",
    HIGH_RISK: "bg-red-50 text-red-700 border-red-200/60 ring-1 ring-inset ring-red-600/10",
  };

  const labels = {
    AUTO_PASS: "Auto Pass",
    REVIEW: "Review",
    HIGH_RISK: "High Risk",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

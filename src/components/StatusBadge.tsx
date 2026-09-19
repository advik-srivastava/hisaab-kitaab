import { DecisionStatus } from "@/types/decisions";

export function StatusBadge({ status }: { status: DecisionStatus }) {
  const styles = {
    AUTO_PASS: "bg-green-100 text-green-800 border-green-200",
    REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
    HIGH_RISK: "bg-red-100 text-red-800 border-red-200",
  };

  const labels = {
    AUTO_PASS: "Auto Pass",
    REVIEW: "Review",
    HIGH_RISK: "High Risk",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

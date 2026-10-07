import { DecisionStatus } from "@/types/decisions";

export function StatusBadge({ status }: { status: DecisionStatus }) {
  const styles = {
    AUTO_PASS: "bg-status-success-bg text-status-success border border-status-success/20",
    REVIEW: "bg-status-warning-bg text-status-warning border border-status-warning/20",
    HIGH_RISK: "bg-status-danger-bg text-status-danger border border-status-danger/20",
  };

  const labels = {
    AUTO_PASS: "Auto Pass",
    REVIEW: "Review",
    HIGH_RISK: "High Risk",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold tracking-widest uppercase ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

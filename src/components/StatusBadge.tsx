import { DecisionStatus } from "@/types/decisions";

export function StatusBadge({ status }: { status: DecisionStatus }) {
  const styles = {
    AUTO_PASS: "bg-status-success-bg text-status-success-text border border-status-success-border shadow-[0_0_10px_rgba(16,185,129,0.1)]",
    REVIEW: "bg-status-warning-bg text-status-warning-text border border-status-warning-border shadow-[0_0_10px_rgba(245,158,11,0.1)]",
    HIGH_RISK: "bg-status-danger-bg text-status-danger-text border border-status-danger-border shadow-[0_0_10px_rgba(239,68,68,0.1)]",
  };

  const labels = {
    AUTO_PASS: "Auto Pass",
    REVIEW: "Review",
    HIGH_RISK: "High Risk",
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold tracking-wide uppercase ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

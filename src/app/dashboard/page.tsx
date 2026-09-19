import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { DecisionStatus } from "@/types/decisions";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of the latest analyzed batch.
        </p>
      </div>

      <div className="bg-blue-50 text-blue-800 p-4 rounded-md border border-blue-200 text-sm">
        <strong>Note:</strong> Showing simulated demo dataset.
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard title="Total Processed" value={120} />
        <MetricCard title="Auto-cleared" value={96} />
        <MetricCard title="Needs Review" value={18} />
        <MetricCard title="High Risk" value={6} />
        <MetricCard title="Duplicate Candidates" value={7} />
        <MetricCard title="Potential Exposure" value={142500} isCurrency />
      </div>

      {/* Visual Summary (Mock) */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <h3 className="text-base font-medium text-slate-900 mb-4">
          Processed Transactions
        </h3>
        <div className="flex h-8 rounded-full overflow-hidden">
          <div className="bg-green-500 w-[80%]" title="Auto Pass (96)"></div>
          <div className="bg-amber-400 w-[15%]" title="Review (18)"></div>
          <div className="bg-red-500 w-[5%]" title="High Risk (6)"></div>
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-2">
          <span>Auto Pass (96)</span>
          <span>Review (18)</span>
          <span>High Risk (6)</span>
        </div>
      </div>

      {/* Priority Exceptions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-slate-900">
            Priority Exceptions
          </h2>
          <Link
            href="/exceptions"
            className="text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            View all exceptions &rarr;
          </Link>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <ul className="divide-y divide-slate-200">
            <li className="p-4 hover:bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <StatusBadge status={"HIGH_RISK" as DecisionStatus} />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      INV-5500 - Contoso Consulting
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Exact duplicate
                    </p>
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  ₹45,000
                </div>
              </div>
            </li>
            <li className="p-4 hover:bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <StatusBadge status={"HIGH_RISK" as DecisionStatus} />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      HTL-450 - Northwind Hotel
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Hotel policy exceeded
                    </p>
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  ₹14,500
                </div>
              </div>
            </li>
            <li className="p-4 hover:bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <StatusBadge status={"REVIEW" as DecisionStatus} />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      MS-4434 - Microsoft India Private Limited
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Potential duplicate
                    </p>
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  ₹18,500
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { DecisionStatus } from "@/types/decisions";

const mockExceptions = [
  {
    id: "INV-5500",
    status: "HIGH_RISK" as DecisionStatus,
    vendor: "Contoso Consulting",
    amount: 45000,
    issue: "Exact duplicate",
  },
  {
    id: "HTL-450",
    status: "HIGH_RISK" as DecisionStatus,
    vendor: "Northwind Hotel",
    amount: 14500,
    issue: "Hotel policy exceeded",
  },
  {
    id: "MS-4434",
    status: "REVIEW" as DecisionStatus,
    vendor: "Microsoft India Private Limited",
    amount: 18500,
    issue: "Potential duplicate",
  },
  {
    id: "MEAL-992",
    status: "REVIEW" as DecisionStatus,
    vendor: "Cafe Delight",
    amount: 2750,
    issue: "Meal policy exceeded",
  },
];

export default function ExceptionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Exception Queue
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review flagged transactions before approval.
          </p>
        </div>
        <div className="flex space-x-2">
          {/* Simple visual filters */}
          <button className="px-3 py-1.5 bg-slate-900 text-white text-sm font-medium rounded-md">
            All
          </button>
          <button className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50">
            High Risk
          </button>
          <button className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50">
            Review
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Risk
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Invoice
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Vendor
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Amount
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Primary Issue
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">View</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {mockExceptions.map((ex) => (
                <tr key={ex.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={ex.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {ex.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {ex.vendor}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                    ₹{ex.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {ex.issue}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/exceptions/${ex.id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View<span className="sr-only">, {ex.id}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

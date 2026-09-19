import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { AuditTimeline } from "@/components/AuditTimeline";
import { DecisionStatus } from "@/types/decisions";
import { AuditEvent } from "@/types/audit";

// This simulates fetching the specific exception by ID.
// For the demo, we are hardcoding the INV-5500 data.
export default function ExceptionDetailPage() {
  const mockAuditEvents: AuditEvent[] = [
    {
      id: "ev-1",
      transactionId: "INV-5500",
      batchId: "b-1",
      timestamp: "2026-09-12T09:41:00Z",
      actorType: "SYSTEM",
      actorId: null,
      action: "Batch processed",
      oldStatus: null,
      newStatus: null,
      note: null,
    },
    {
      id: "ev-2",
      transactionId: "INV-5500",
      batchId: "b-1",
      timestamp: "2026-09-12T09:41:05Z",
      actorType: "SYSTEM",
      actorId: null,
      action: "Exact duplicate detected",
      oldStatus: null,
      newStatus: null,
      note: "Matched with TXN-009",
    },
    {
      id: "ev-3",
      transactionId: "INV-5500",
      batchId: "b-1",
      timestamp: "2026-09-12T09:41:06Z",
      actorType: "SYSTEM",
      actorId: null,
      action: "Status changed",
      oldStatus: null,
      newStatus: "HIGH_RISK" as DecisionStatus,
      note: null,
    },
    {
      id: "ev-4",
      transactionId: "INV-5500",
      batchId: "b-1",
      timestamp: "2026-09-12T09:43:00Z",
      actorType: "USER",
      actorId: "Finance Reviewer",
      action: "Reviewer opened case",
      oldStatus: "HIGH_RISK" as DecisionStatus,
      newStatus: "HIGH_RISK" as DecisionStatus,
      note: null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center space-x-2 text-sm text-slate-500">
        <Link href="/exceptions" className="hover:text-slate-900">
          Exceptions
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900">INV-5500</span>
      </div>

      {/* Header Section */}
      <div className="bg-white border-l-4 border-l-red-500 border-y border-r border-slate-200 p-6 rounded-r-lg shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge status={"HIGH_RISK" as DecisionStatus} />
              <h1 className="text-xl font-semibold text-slate-900">
                Possible Duplicate Invoice
              </h1>
            </div>
            <div className="flex gap-6 mt-4 text-sm">
              <div>
                <span className="text-slate-500">Invoice:</span>{" "}
                <span className="font-medium text-slate-900">INV-5500</span>
              </div>
              <div>
                <span className="text-slate-500">Vendor:</span>{" "}
                <span className="font-medium text-slate-900">
                  Contoso Consulting
                </span>
              </div>
              <div>
                <span className="text-slate-500">Amount:</span>{" "}
                <span className="font-medium text-slate-900">₹45,000</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Side-by-Side Comparison */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex">
              <div className="w-1/2 font-semibold text-slate-900">
                CURRENT RECORD
              </div>
              <div className="w-1/2 font-semibold text-slate-900 border-l border-slate-300 pl-6">
                MATCHED RECORD
              </div>
            </div>
            <div className="flex divide-x divide-slate-200 text-sm">
              <div className="w-1/2 p-6 space-y-4">
                <div>
                  <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                    Invoice
                  </div>
                  <div className="font-medium text-slate-900">INV-5500</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                    Vendor
                  </div>
                  <div className="font-medium text-slate-900">
                    Contoso Consulting
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                    Amount
                  </div>
                  <div className="font-medium text-slate-900 bg-red-50 text-red-700 py-0.5 px-2 rounded-sm inline-block">
                    ₹45,000
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                    Invoice Date
                  </div>
                  <div className="font-medium text-slate-900">
                    12 Sep 2026
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                    Transaction
                  </div>
                  <div className="font-medium text-slate-900">TXN-010</div>
                </div>
              </div>

              <div className="w-1/2 p-6 space-y-4 bg-slate-50/50">
                <div>
                  <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                    Invoice
                  </div>
                  <div className="font-medium text-slate-900">INV-5500</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                    Vendor
                  </div>
                  <div className="font-medium text-slate-900">
                    Contoso Consulting
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                    Amount
                  </div>
                  <div className="font-medium text-slate-900 bg-red-50 text-red-700 py-0.5 px-2 rounded-sm inline-block">
                    ₹45,000
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                    Invoice Date
                  </div>
                  <div className="font-medium text-slate-900">
                    12 Sep 2026
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">
                    Transaction
                  </div>
                  <div className="font-medium text-blue-600 underline cursor-pointer">
                    TXN-009
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Why this was flagged */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4">
              Why this was flagged
            </h3>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center text-sm text-slate-700">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Same invoice number
              </li>
              <li className="flex items-center text-sm text-slate-700">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Same normalized vendor
              </li>
              <li className="flex items-center text-sm text-slate-700">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Same amount
              </li>
              <li className="flex items-center text-sm text-slate-700">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Dates match
              </li>
            </ul>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-blue-900">Recommended action</h4>
                <p className="text-sm text-blue-800 mt-1">
                  Verify whether this invoice has already been submitted or paid before releasing payment.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-md shadow-sm transition-colors">
              APPROVE
            </button>
            <button className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-md shadow-sm transition-colors">
              REJECT
            </button>
            <button className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold py-2.5 px-4 rounded-md shadow-sm transition-colors">
              MARK NOT DUPLICATE
            </button>
          </div>
        </div>

        {/* Audit Timeline Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 sticky top-6">
            <h3 className="text-base font-semibold text-slate-900 mb-6">
              Audit History
            </h3>
            <AuditTimeline events={mockAuditEvents} />
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";

export default function UploadPage() {
  return (
    <div className="max-w-3xl mx-auto mt-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">
          Upload Invoice Batch
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Upload CSV or Excel files to identify policy exceptions and possible
          duplicate transactions.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
        <div className="max-w-md mx-auto">
          <div className="mt-4 flex justify-center rounded-lg border border-dashed border-slate-300 px-6 py-10">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-slate-300"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                width="48"
                height="48"
              >
                <path
                  fillRule="evenodd"
                  d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="mt-4 flex text-sm leading-6 text-slate-600 justify-center">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer rounded-md bg-white font-semibold text-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 hover:text-blue-500"
                >
                  <span>Upload a file</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs leading-5 text-slate-500">
                CSV or XLSX up to 10MB
              </p>
            </div>
          </div>
        </div>

        {/* Mock selected files */}
        <div className="mt-8 max-w-md mx-auto text-left">
          <h4 className="text-sm font-medium text-slate-900">Selected Files</h4>
          <ul className="mt-3 space-y-3">
            <li className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-md border border-slate-200">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded flex items-center justify-center text-xs font-bold">
                  XLSX
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-slate-900">
                    September_AP.xlsx
                  </p>
                  <p className="text-xs text-slate-500">Ready</p>
                </div>
              </div>
            </li>
            <li className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-md border border-slate-200">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-green-100 text-green-600 rounded flex items-center justify-center text-xs font-bold">
                  CSV
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-slate-900">
                    Expense_Claims.csv
                  </p>
                  <p className="text-xs text-slate-500">Ready</p>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <div className="mt-10">
          <Link
            href="/dashboard"
            className="inline-flex justify-center rounded-md bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Analyze Batch
          </Link>
          <p className="mt-3 text-xs text-slate-500 flex items-center justify-center gap-1">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              width="16"
              height="16"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            Files are analyzed against configured Finance policies.
          </p>
        </div>
      </div>
    </div>
  );
}

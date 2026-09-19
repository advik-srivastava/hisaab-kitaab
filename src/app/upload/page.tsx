"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { processBatch } from "@/core/pipeline";

export default function UploadPage() {
  const router = useRouter();
  const processingRef = useRef(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter((f) => {
        const name = f.name.toLowerCase();
        return name.endsWith(".csv") || name.endsWith(".xlsx");
      });
      setFiles((prev) => [...prev, ...selectedFiles]);
      setError(null);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) => {
      const name = f.name.toLowerCase();
      return name.endsWith(".csv") || name.endsWith(".xlsx");
    });
    setFiles((prev) => [...prev, ...droppedFiles]);
    setError(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (files.length === 0 || processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setError(null);

    try {
      const result = await processBatch(files);
      if (result.transactions.length > 0) {
        if (result.fileErrors.length > 0) {
          setError(`${result.fileErrors.length} file(s) could not be processed. Valid files were analyzed successfully.`);
        } else {
          router.push("/dashboard");
        }
      } else {
        setError("All files failed to process or no valid transactions were found.");
      }
    } catch {
      setError("An unexpected error occurred during processing.");
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  };

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
          <div
            className="mt-4 flex justify-center rounded-lg border border-dashed border-slate-300 px-6 py-10"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
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
                    multiple
                    accept=".csv,.xlsx"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs leading-5 text-slate-500">
                CSV or XLSX only
              </p>
            </div>
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-8 max-w-md mx-auto text-left">
            <h4 className="text-sm font-medium text-slate-900">Selected Files</h4>
            <ul className="mt-3 space-y-3">
              {files.map((file, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-md border border-slate-200"
                >
                  <div className="flex items-center">
                    <div
                      className={`h-8 w-8 rounded flex items-center justify-center text-xs font-bold ${
                        file.name.endsWith(".csv")
                          ? "bg-green-100 text-green-600"
                          : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {file.name.split(".").pop()?.toUpperCase()}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-slate-900 truncate w-48">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(idx)}
                    className="text-slate-400 hover:text-slate-600 focus:outline-none"
                    disabled={isProcessing}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="mt-6 max-w-md mx-auto bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md text-sm text-left flex flex-col gap-2">
            <p>{error}</p>
            {error.includes("successfully") && (
              <button
                onClick={() => router.push("/dashboard")}
                className="self-start text-amber-900 font-semibold underline text-sm"
              >
                Continue to Dashboard
              </button>
            )}
          </div>
        )}

        <div className="mt-10">
          <button
            onClick={handleAnalyze}
            disabled={files.length === 0 || isProcessing}
            className={`inline-flex justify-center rounded-md px-6 py-2.5 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
              files.length === 0 || isProcessing
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 focus-visible:outline-blue-600"
            }`}
          >
            {isProcessing ? "Analyzing..." : "Analyze Batch"}
          </button>
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

"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ProcessingStage } from "@/core/pipeline";
import { processBatchInWorker } from "@/lib/worker";

const progressLabels: Partial<Record<ProcessingStage, string>> = {
  READING_FILES: "Reading files...",
  NORMALIZING: "Normalizing transactions...",
  EVALUATING_RULES: "Evaluating policies...",
  CHECKING_DUPLICATES: "Checking duplicates...",
  MAKING_DECISIONS: "Making decisions...",
  SAVING_RESULTS: "Saving results...",
  COMPLETE: "Analysis complete",
};

export default function UploadPage() {
  const router = useRouter();
  const processingRef = useRef(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState<ProcessingStage>();
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
    setProgressStage(undefined);
    setError(null);

    try {
      const result = await processBatchInWorker(files, {}, ({ stage }) => {
        setProgressStage(stage);
      });
      if (result.transactions.length > 0) {
        if (!result.persistence.success) {
          setError(result.persistence.error?.message ?? "Analysis completed, but the batch could not be saved.");
        } else if (result.fileErrors.length > 0) {
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
      setProgressStage(undefined);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-12 mb-20">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Upload Invoice Batch
        </h1>
        <p className="mt-3 text-base text-slate-600 max-w-xl mx-auto">
          Upload a Finance batch (CSV or XLSX) and let <span className="font-semibold text-slate-700">hisaab<span className="text-blue-600">किताब</span></span> analyze it for policy exceptions and potential duplicates.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 shadow-sm text-center">
        <div className="max-w-lg mx-auto">
          <div
            className={`flex justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-colors duration-200 ${
              isProcessing ? "border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed" : "border-slate-300 hover:border-blue-400 hover:bg-blue-50/50"
            }`}
            onDrop={isProcessing ? undefined : handleDrop}
            onDragOver={isProcessing ? undefined : handleDragOver}
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
          <div className="mt-10 max-w-lg mx-auto text-left">
            <h4 className="text-sm font-semibold text-slate-900 flex items-center justify-between">
              <span>Selected Files</span>
              <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{files.length} file{files.length !== 1 && 's'}</span>
            </h4>
            <ul className="mt-4 space-y-3">
              {files.map((file, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-sm"
                >
                  <div className="flex items-center">
                    <div
                      className={`h-10 w-10 rounded flex items-center justify-center text-xs font-bold ${
                        file.name.endsWith(".csv")
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                          : "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20"
                      }`}
                    >
                      {file.name.split(".").pop()?.toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-slate-900 truncate w-48 sm:w-64">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(idx)}
                    className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-md transition-colors focus:outline-none"
                    disabled={isProcessing}
                    aria-label="Remove file"
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
          <div className="mt-8 max-w-lg mx-auto bg-red-50 border border-red-200 text-red-800 px-5 py-4 rounded-lg text-sm text-left flex flex-col gap-3 shadow-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-semibold text-red-900">{error.includes("successfully") ? "Partial Processing Complete" : "Processing Failed"}</p>
                <p className="mt-1 text-red-700 leading-relaxed">{error}</p>
              </div>
            </div>
            {error.includes("successfully") && (
              <button
                onClick={() => router.push("/dashboard")}
                className="mt-1 ml-8 self-start inline-flex items-center gap-1.5 text-red-900 font-bold hover:text-red-700 transition-colors"
              >
                Continue to Dashboard
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className="mt-12 flex flex-col items-center">
          <button
            onClick={handleAnalyze}
            disabled={files.length === 0 || isProcessing}
            className={`inline-flex items-center justify-center rounded-lg px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 w-full sm:w-auto min-w-[200px] ${
              files.length === 0
                ? "bg-slate-300 cursor-not-allowed"
                : isProcessing
                ? "bg-blue-600/90 cursor-wait"
                : "bg-blue-600 hover:bg-blue-700 hover:shadow-md focus-visible:outline-blue-600"
            }`}
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {progressStage ? progressLabels[progressStage] : "Analyzing..."}
              </>
            ) : (
              "Analyze Batch"
            )}
          </button>
          
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
            <svg
              className="w-4 h-4 text-emerald-600"
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
            Files are analyzed against configured Finance policies
          </div>
        </div>
      </div>
    </div>
  );
}

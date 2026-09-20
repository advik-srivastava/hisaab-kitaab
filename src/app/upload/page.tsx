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
    <div className="max-w-3xl mx-auto mt-12 mb-20 relative z-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">
          Upload Invoice Batch
        </h1>
        <p className="mt-3 text-base text-text-secondary max-w-xl mx-auto">
          Upload a Finance batch (CSV or XLSX) and let <span className="font-semibold text-text-primary">hisaab<span className="text-brand-primary">किताब</span></span> analyze it for policy exceptions and potential duplicates.
        </p>
      </div>

      <div className="card p-8 sm:p-12 text-center relative overflow-hidden">
        {/* Glow effect inside card */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-brand-primary/10 blur-[80px] pointer-events-none"></div>

        <div className="max-w-lg mx-auto relative z-10">
          <div
            className={`flex justify-center rounded-2xl border-2 border-dashed px-6 py-12 transition-all duration-[240ms] ease-[cubic-bezier(.22,1,.36,1)] ${
              isProcessing ? "border-panel-border bg-panel opacity-50 cursor-not-allowed" : "border-panel-border/80 hover:border-brand-primary/50 hover:bg-brand-primary/5 hover:shadow-[0_0_30px_rgba(59,130,246,0.1)] cursor-pointer"
            }`}
            onDrop={isProcessing ? undefined : handleDrop}
            onDragOver={isProcessing ? undefined : handleDragOver}
          >
            <div className="text-center">
              <div className="mx-auto w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-panel border border-panel-border shadow-lg">
                <svg
                  className="h-8 w-8 text-brand-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="mt-4 flex text-sm leading-6 text-text-secondary justify-center">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer rounded-md font-semibold text-brand-primary hover:text-blue-400 focus-within:outline-none transition-colors"
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
              <p className="text-xs leading-5 text-text-muted mt-2">
                CSV or XLSX up to 50MB
              </p>
            </div>
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-10 max-w-lg mx-auto text-left relative z-10">
            <h4 className="text-sm font-semibold text-text-primary flex items-center justify-between">
              <span>Selected Files</span>
              <span className="text-xs font-bold text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-3 py-1 rounded-full">{files.length} file{files.length !== 1 && 's'}</span>
            </h4>
            <ul className="mt-4 space-y-3">
              {files.map((file, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between bg-panel px-4 py-4 rounded-xl border border-panel-border hover:border-panel-border-hover transition-colors shadow-sm"
                >
                  <div className="flex items-center">
                    <div
                      className={`h-12 w-12 rounded-lg flex items-center justify-center text-xs font-bold shadow-inner ${
                        file.name.endsWith(".csv")
                          ? "bg-status-success-bg text-status-success-text border border-status-success-border"
                          : "bg-brand-primary/10 text-brand-primary border border-brand-primary/20"
                      }`}
                    >
                      {file.name.split(".").pop()?.toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-semibold text-text-primary truncate w-48 sm:w-64">
                        {file.name}
                      </p>
                      <p className="text-xs text-text-secondary mt-1">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(idx)}
                    className="text-text-muted hover:text-status-danger-text hover:bg-status-danger-bg p-2 rounded-lg transition-colors focus:outline-none"
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
          <div className="mt-8 max-w-lg mx-auto bg-status-danger-bg border border-status-danger-border text-status-danger-text px-5 py-4 rounded-xl text-sm text-left flex flex-col gap-3 shadow-[0_0_20px_rgba(239,68,68,0.1)] relative z-10">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-bold">{error.includes("successfully") ? "Partial Processing Complete" : "Processing Failed"}</p>
                <p className="mt-1 opacity-90 leading-relaxed">{error}</p>
              </div>
            </div>
            {error.includes("successfully") && (
              <button
                onClick={() => router.push("/dashboard")}
                className="mt-1 ml-8 self-start inline-flex items-center gap-1.5 font-bold hover:opacity-80 transition-opacity"
              >
                Continue to Dashboard
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className="mt-12 flex flex-col items-center relative z-10">
          <button
            onClick={handleAnalyze}
            disabled={files.length === 0 || isProcessing}
            className={`btn-primary w-full sm:w-auto min-w-[240px] h-12 text-base ${
              files.length === 0
                ? "opacity-50 cursor-not-allowed hover:shadow-none hover:bg-brand-primary"
                : isProcessing
                ? "cursor-wait opacity-90 hover:shadow-[0_0_20px_var(--color-brand-glow)]"
                : ""
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {progressStage ? progressLabels[progressStage] : "Analyzing..."}
              </div>
            ) : (
              "Analyze Batch"
            )}
          </button>
          
          <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-text-secondary bg-panel border border-panel-border px-4 py-2 rounded-full">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success-text opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-status-success-text"></span>
            </span>
            Worker ready for background processing
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  isSupportedUploadFile,
  MAX_UPLOAD_FILE_SIZE_BYTES,
} from "@/config/uploads";
import type { IngestionFileError } from "@/core/ingestion";
import type { ProcessingStage } from "@/core/pipeline";
import { processBatchInWorker } from "@/lib/worker";
import { getActiveFinancePolicy } from "@/lib/storage";
import type { FinancePolicy } from "@/types/policies";
import { PolicyRequiredState } from "@/components/PolicyRequiredState";

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
  const serverMode = process.env.NEXT_PUBLIC_APP_MODE === "SERVER";
  const processingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState<ProcessingStage>();
  const [error, setError] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<IngestionFileError[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [activePolicy, setActivePolicy] = useState<FinancePolicy>();
  const [policyLoaded, setPolicyLoaded] = useState(serverMode);

  useEffect(() => {
    if (serverMode) return;
    let mounted = true;
    void getActiveFinancePolicy()
      .then((policy) => { if (mounted) setActivePolicy(policy); })
      .finally(() => { if (mounted) setPolicyLoaded(true); });
    return () => { mounted = false; };
  }, [serverMode]);

  const addFiles = useCallback((selectedFiles: File[]) => {
    setNotice(null);
    const unsupported = selectedFiles.filter((file) => !isSupportedUploadFile(file.name));
    const oversized = selectedFiles.filter((file) => file.size > MAX_UPLOAD_FILE_SIZE_BYTES);
    const validFiles = selectedFiles.filter(
      (file) => isSupportedUploadFile(file.name) && file.size <= MAX_UPLOAD_FILE_SIZE_BYTES,
    );
    const selectedKeys = new Set(
      files.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
    );
    const uniqueFiles = validFiles.filter((file) => {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (selectedKeys.has(key)) return false;
      selectedKeys.add(key);
      return true;
    });
    const duplicateCount = validFiles.length - uniqueFiles.length;
    const issues = [
      unsupported.length > 0 ? `${unsupported.length} unsupported file${unsupported.length === 1 ? " was" : "s were"} skipped.` : "",
      oversized.length > 0 ? `${oversized.length} file${oversized.length === 1 ? " exceeds" : "s exceed"} the 50 MB limit.` : "",
      duplicateCount > 0 ? `${duplicateCount} duplicate file${duplicateCount === 1 ? " was" : "s were"} already selected.` : "",
    ].filter(Boolean);

    if (uniqueFiles.length > 0) {
      setFiles((previous) => [...previous, ...uniqueFiles]);
    }
    setFileErrors([]);
    setError(issues.length > 0 ? issues.join(" ") : null);
  }, [files]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (files.length === 0 || processingRef.current) return;
    if (!serverMode && !activePolicy) {
      setError("Activate a finance policy before analyzing this batch.");
      return;
    }
    processingRef.current = true;
    setIsProcessing(true);
    setProgressStage(undefined);
    setError(null);
    setFileErrors([]);
    setNotice(null);

    try {
      if (serverMode) {
        const batchId = crypto.randomUUID();
        const results = await Promise.all(files.map(async (file) => {
          const form = new FormData();
          form.set("batchId", batchId);
          form.set("file", file);
          const response = await fetch("/api/uploads", { method: "POST", body: form });
          return response.ok;
        }));
        const uploaded = results.filter(Boolean).length;
        if (uploaded === 0) throw new Error("No files passed secure upload validation.");
        const queued = await fetch("/api/jobs", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ batchId }),
        });
        const body = await queued.json() as { error?: { message?: string } };
        if (!queued.ok) throw new Error(body.error?.message ?? "Server processing could not be queued.");
        setNotice(`Batch ${batchId} was queued with ${uploaded} file(s)${uploaded < files.length ? `; ${files.length - uploaded} file(s) failed validation` : ""}.`);
        setFiles([]);
        return;
      }
      const result = await processBatchInWorker(files, { policy: activePolicy }, ({ stage }) => {
        setProgressStage(stage);
      });
      setFileErrors(result.fileErrors);
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "An unexpected error occurred during processing.");
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
      setProgressStage(undefined);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-12 mb-20 relative z-10">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-heading font-bold text-text-primary tracking-tight mb-4">
          Invoice Batch Analysis
        </h1>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto">
          Securely process your Finance batch (CSV or XLSX) to instantly identify policy exceptions and duplicate transactions.
        </p>
        {!serverMode && activePolicy && <div className="mt-5 inline-flex flex-col rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-5 py-3 text-left"><span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Active Policy</span><span className="mt-1 text-sm font-bold text-text-primary">{activePolicy.companyName}</span><span className="text-xs text-text-secondary">{activePolicy.policyName} • v{activePolicy.version}</span></div>}
      </div>

      {!serverMode && policyLoaded && !activePolicy && <div className="mb-8"><PolicyRequiredState compact /></div>}

      <div className="card p-8 sm:p-14 text-center relative overflow-hidden bg-white shadow-xl shadow-brand-primary/5 border-panel-border/80">
        <div className="max-w-lg mx-auto relative z-10">
          <input
            ref={fileInputRef}
            id="file-upload"
            name="file-upload"
            type="file"
            multiple
            accept=".csv,.xlsx"
            className="sr-only"
            onChange={handleFileChange}
            disabled={isProcessing}
          />
          <div
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-16 transition-all duration-[240ms] ease-[cubic-bezier(.22,1,.36,1)] ${
              isProcessing 
                ? "border-panel-border bg-slate-50/50 opacity-60 cursor-not-allowed" 
                : isDragging
                  ? "border-brand-primary bg-brand-primary/10 shadow-[0_0_30px_rgba(59,130,246,0.15)] cursor-copy"
                  : "border-brand-primary/20 bg-brand-primary/[0.02] hover:border-brand-primary/50 hover:bg-brand-primary/[0.04] cursor-pointer"
            }`}
            role="button"
            tabIndex={isProcessing ? -1 : 0}
            aria-controls="file-upload"
            aria-disabled={isProcessing}
            onClick={() => { if (!isProcessing) fileInputRef.current?.click(); }}
            onKeyDown={(event) => {
              if (!isProcessing && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragEnter={isProcessing ? undefined : (event) => { event.preventDefault(); setIsDragging(true); }}
            onDragLeave={isProcessing ? undefined : () => setIsDragging(false)}
            onDrop={isProcessing ? undefined : handleDrop}
            onDragOver={isProcessing ? undefined : handleDragOver}
          >
            <div className="text-center flex flex-col items-center">
              <div className="mb-6 flex items-center justify-center rounded-full bg-white shadow-sm border border-brand-primary/10 p-4">
                <svg
                  className="h-10 w-10 text-brand-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="flex text-base leading-6 text-text-primary font-medium justify-center items-center gap-1">
                <span className={`relative rounded-md font-bold text-brand-primary transition-colors ${isProcessing ? "opacity-60" : "hover:text-brand-primary/80"}`}>Select a file</span>
                <p>or drag and drop it here</p>
              </div>
              <p className="text-sm text-text-secondary mt-3">
                Supports CSV or XLSX up to 50MB
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
                <p className="font-bold">
                  {error.includes("successfully")
                    ? "Partial Processing Complete"
                    : error.includes("skipped") || error.includes("limit") || error.includes("already selected")
                      ? "File selection updated"
                      : "Processing Failed"}
                </p>
                <p className="mt-1 opacity-90 leading-relaxed">{error}</p>
                {fileErrors.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs font-medium opacity-90">
                    {fileErrors.map((fileError, index) => (
                      <li key={`${fileError.fileName}-${fileError.code}-${index}`}>
                        {fileError.fileName}: {fileError.message}
                      </li>
                    ))}
                  </ul>
                )}
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

        {notice && <div role="status" className="mt-8 max-w-lg mx-auto bg-status-success-bg border border-status-success-border text-status-success-text px-5 py-4 rounded-xl text-sm text-left relative z-10"><p className="font-bold">Processing queued</p><p className="mt-1">{notice}</p><p className="mt-1 opacity-80">The server worker will publish results and notifications when configured processing completes.</p></div>}

        <div className="mt-12 flex flex-col items-center relative z-10">
          <button
            onClick={handleAnalyze}
            disabled={files.length === 0 || isProcessing || (!serverMode && (!policyLoaded || !activePolicy))}
            className={`btn-primary w-full sm:w-auto min-w-[240px] h-12 text-base ${
              files.length === 0 || (!serverMode && (!policyLoaded || !activePolicy))
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
          {!serverMode && policyLoaded && !activePolicy && <p className="mt-3 text-sm font-medium text-status-warning-text">Activate a company policy before analyzing invoices.</p>}
          <div className="mt-7 border-t border-panel-border pt-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Need a template?</p>
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              <a className="text-sm font-bold text-brand-primary hover:underline" href="/templates/hisaab-kitaab-invoice-batch-sample.csv" download>Download Sample CSV</a>
              <a className="text-sm font-bold text-text-secondary hover:text-text-primary" href="/templates/hisaab-kitaab-invoice-batch-sample.csv" target="_blank">View Required Columns</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

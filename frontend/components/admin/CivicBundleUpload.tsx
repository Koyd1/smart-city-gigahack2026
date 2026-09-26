"use client";

import { Archive } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAppTranslation } from "@/lib/i18n/I18nProvider";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ACTIVE_STATUSES = new Set(["PENDING", "PROCESSING"]);

type ImportResult = {
  id: string;
  filename: string;
  status: "PENDING" | "PROCESSING" | "READY" | "PARTIAL" | "ERROR";
  documents?: number;
  chunks?: number;
  summary?: {
    imported: number;
    skipped: number;
    failed: number;
  };
  error?: string;
};

type UploadResponse = {
  jobId: string;
  status: ImportResult["status"];
  documents: number;
  chunks: number;
  detail?: string;
};

type CivicBundleUploadProps = {
  onImported: () => Promise<void>;
};

export default function CivicBundleUpload({ onImported }: CivicBundleUploadProps) {
  const { t } = useAppTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [job, setJob] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!job?.id || !ACTIVE_STATUSES.has(job.status)) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(
          `/api/upload/civic-bundle?jobId=${encodeURIComponent(job.id)}`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error(t("admin.civicBundle.statusFailed"));
        const result = (await response.json()) as ImportResult;
        if (cancelled) return;
        setJob(result);
        if (!ACTIVE_STATUSES.has(result.status)) {
          await onImported();
        }
      } catch {
        if (!cancelled) setError(t("admin.civicBundle.statusFailed"));
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [job?.id, job?.status, onImported, t]);

  async function uploadBundle(file: File) {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError(t("admin.civicBundle.unsupported"));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(t("admin.civicBundle.fileTooLarge"));
      return;
    }

    setIsUploading(true);
    setError(null);
    setJob(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload/civic-bundle", {
        method: "POST",
        body: formData
      });
      const result = (await response.json()) as UploadResponse;
      if (!response.ok) throw new Error(result.detail ?? t("admin.civicBundle.uploadFailed"));
      setJob({
        id: result.jobId,
        filename: file.name,
        status: result.status,
        documents: result.documents,
        chunks: result.chunks
      });
      if (inputRef.current) inputRef.current.value = "";
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : t("admin.civicBundle.uploadFailed")
      );
    } finally {
      setIsUploading(false);
    }
  }

  const isActive = job ? ACTIVE_STATUSES.has(job.status) : false;
  const resultMessage = job?.summary
    ? t("admin.civicBundle.completed", job.summary)
    : job?.status === "PARTIAL"
      ? t("admin.civicBundle.partial")
      : job?.status === "READY"
        ? t("admin.civicBundle.completedEmpty")
        : null;

  return (
    <div className="flex w-full flex-col items-stretch gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        className="sr-only"
        disabled={isUploading || isActive}
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          if (file) await uploadBundle(file);
        }}
      />
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full min-w-[220px] text-base sm:w-auto xl:self-end"
        disabled={isUploading || isActive}
        onClick={() => inputRef.current?.click()}
      >
        <Archive className="h-4 w-4" aria-hidden="true" />
        {isUploading
          ? t("admin.civicBundle.uploading")
          : isActive
            ? t("admin.civicBundle.processing")
            : t("admin.civicBundle.button")}
      </Button>
      {job && isActive ? (
        <Alert variant="success">
          {t("admin.civicBundle.progress", {
            filename: job.filename,
            documents: job.documents ?? 0,
            chunks: job.chunks ?? 0
          })}
        </Alert>
      ) : null}
      {resultMessage ? <Alert variant="success">{resultMessage}</Alert> : null}
      {job?.status === "ERROR" ? (
        <Alert variant="error">{job.error || t("admin.civicBundle.importFailed")}</Alert>
      ) : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}

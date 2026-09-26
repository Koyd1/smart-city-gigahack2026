"use client";

import { useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAppTranslation } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type FileUploadProps = {
  onUploaded: () => Promise<void>;
  compact?: boolean;
  buttonLabel?: string;
  className?: string;
};

const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp"];
const MAX_FILE_MB = 15;

function hasSupportedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export default function FileUpload({
  onUploaded,
  compact = false,
  buttonLabel,
  className
}: FileUploadProps) {
  const { t } = useAppTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function uploadFile(file: File) {
    if (!hasSupportedExtension(file.name)) {
      setError(t("admin.fileUpload.unsupported"));
      return;
    }

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(t("admin.fileUpload.fileTooLarge", { size: MAX_FILE_MB }));
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(t("admin.fileUpload.uploadFailed"));
      }

      setSuccess(t("admin.fileUpload.uploaded", { name: file.name }));
      await onUploaded();
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch {
      setError(t("admin.fileUpload.uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div
      className={cn(
        compact
          ? "flex w-full flex-col items-stretch gap-3 xl:items-stretch"
          : "rounded-2xl border border-[#edf0f5] bg-white p-6 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.85)]",
        className
      )}
    >
      {!compact ? (
        <div className="space-y-1">
          <h2 className="m-0 text-lg font-semibold text-[#101828]">{t("admin.fileUpload.title")}</h2>
          <p className="m-0 text-sm text-[#667085]">
            {t("admin.fileUpload.description", { size: MAX_FILE_MB })}
          </p>
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
        disabled={isUploading}
        onChange={async (event) => {
          const selected = event.currentTarget.files?.[0];
          if (selected) {
            await uploadFile(selected);
          }
        }}
      />
      <Button
        type="button"
        variant="primary"
        size="lg"
        className="w-full min-w-[220px] text-base sm:w-auto xl:self-end"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        <span className="text-base leading-none">↑</span>
        {isUploading ? t("admin.fileUpload.buttonUploading") : buttonLabel ?? t("admin.knowledge.uploadButton")}
      </Button>

      {error ? <Alert variant="error" className={compact ? "w-full" : undefined}>{error}</Alert> : null}
      {success ? <Alert variant="success" className={compact ? "w-full" : undefined}>{success}</Alert> : null}
      {!compact ? (
        <p className="m-0 text-xs text-[#98a2b3]">
          {t("admin.fileUpload.footer")}
        </p>
      ) : null}
    </div>
  );
}

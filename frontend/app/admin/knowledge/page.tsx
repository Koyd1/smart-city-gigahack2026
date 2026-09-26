"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import FileTable, { type KnowledgeFileRow } from "@/components/admin/FileTable";
import FileUpload from "@/components/admin/FileUpload";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useAppTranslation } from "@/lib/i18n/I18nProvider";

const POLLABLE_STATUSES = new Set<KnowledgeFileRow["status"]>(["PENDING", "PROCESSING"]);

type ListResponse = {
  items: KnowledgeFileRow[];
};

type LoadFilesOptions = {
  silent?: boolean;
};

function filenameFromContentDisposition(contentDisposition: string | null): string | null {
  if (!contentDisposition) {
    return null;
  }

  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1]);
    } catch {
      return encodedMatch[1];
    }
  }

  const plainMatch = contentDisposition.match(/filename="([^"]+)"/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return null;
}

function filesAreEqual(current: KnowledgeFileRow[], next: KnowledgeFileRow[]): boolean {
  if (current.length !== next.length) {
    return false;
  }

  return current.every((file, index) => {
    const candidate = next[index];
    return (
      file.id === candidate.id &&
      file.filename === candidate.filename &&
      file.size === candidate.size &&
      file.status === candidate.status &&
      file.chunkCount === candidate.chunkCount &&
      file.createdAt === candidate.createdAt &&
      file.updatedAt === candidate.updatedAt
    );
  });
}

export default function AdminKnowledgePage() {
  const { t } = useAppTranslation();
  const [files, setFiles] = useState<KnowledgeFileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const hasPollableRows = useMemo(
    () => files.some((file) => POLLABLE_STATUSES.has(file.status)),
    [files]
  );
  const filteredFiles = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const filtered = normalized
      ? files.filter((file) => file.filename.toLowerCase().includes(normalized))
      : files;

    return [...filtered].sort((left, right) => {
      const leftDate = new Date(left.createdAt).getTime();
      const rightDate = new Date(right.createdAt).getTime();
      if (sortOrder === "oldest") {
        return leftDate - rightDate;
      }
      return rightDate - leftDate;
    });
  }, [files, search, sortOrder]);

  const loadFiles = useCallback(async ({ silent = false }: LoadFilesOptions = {}) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await fetch("/api/upload", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(t("admin.knowledge.loadFailed"));
      }
      const payload = (await response.json()) as ListResponse;
      const nextFiles = payload.items ?? [];
      setFiles((current) => (filesAreEqual(current, nextFiles) ? current : nextFiles));
    } catch {
      if (!silent) {
        setError(t("admin.knowledge.loadFailed"));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    if (!hasPollableRows) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadFiles({ silent: true });
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasPollableRows, loadFiles]);

  async function handleDelete(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/upload/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(t("admin.knowledge.deleteFailed"));
      }
      await loadFiles();
    } catch {
      setError(t("admin.knowledge.deleteFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/upload/${id}/download`, {
        method: "GET",
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(t("admin.knowledge.downloadFailed"));
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition");
      const fallbackName = files.find((file) => file.id === id)?.filename ?? `knowledge-${id}`;
      const filename = filenameFromContentDisposition(contentDisposition) ?? fallbackName;

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError(t("admin.knowledge.downloadFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReindex(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/upload/${id}`, { method: "POST" });
      if (!response.ok) {
        throw new Error(t("admin.knowledge.reindexFailed"));
      }
      await loadFiles();
    } catch {
      setError(t("admin.knowledge.reindexFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="w-full">
      <section className="w-full pt-3">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[760px]">
            <h1 className="m-0 text-[2.25rem] font-bold tracking-[-0.02em] text-[#111827] md:text-[2.75rem]">
              {t("admin.knowledge.title")}
            </h1>
            <p className="mt-3 text-lg leading-relaxed text-[#6b7280]">
              {t("admin.knowledge.description")}
            </p>
          </div>
          <FileUpload
            onUploaded={loadFiles}
            compact
            buttonLabel={t("admin.knowledge.uploadButton")}
            className="w-full xl:w-[560px] xl:max-w-[560px] xl:shrink-0"
          />
        </div>
        {error ? (
          <Alert variant="error" className="mt-6 max-w-[760px]">
            {error}
          </Alert>
        ) : null}
        <div className="mt-10 max-w-[480px]">
          <Input
            icon={
              <svg
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M13.125 13.125L17 17M15.3333 8.66667C15.3333 12.3486 12.3486 15.3333 8.66667 15.3333C4.98477 15.3333 2 12.3486 2 8.66667C2 4.98477 4.98477 2 8.66667 2C12.3486 2 15.3333 4.98477 15.3333 8.66667Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            }
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("admin.knowledge.searchPlaceholder")}
            wrapperClassName="rounded-2xl bg-[#f6f8fc] border-[#eef1f6] px-4 py-0"
            className="py-3 text-sm"
            aria-label={t("admin.knowledge.searchAriaLabel")}
          />
        </div>
      </section>

      <div className="pt-14">
        <FileTable
          files={filteredFiles}
          totalCount={files.length}
          loading={loading}
          busyId={busyId}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onReindex={handleReindex}
        />
      </div>
    </div>
  );
}

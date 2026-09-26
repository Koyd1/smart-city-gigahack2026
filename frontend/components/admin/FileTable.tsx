"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { useAppTranslation } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

export type KnowledgeFileRow = {
  id: string;
  filename: string;
  displayName?: string;
  size: number;
  status: "PENDING" | "PROCESSING" | "READY" | "ERROR";
  chunkCount: number | null;
  createdAt: string;
  updatedAt: string;
};

type FileTableProps = {
  files: KnowledgeFileRow[];
  totalCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  busyId: string | null;
  sortOrder: "newest" | "oldest";
  onSortOrderChange: (value: "newest" | "oldest") => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDownload: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReindex: (id: string) => Promise<void>;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleDateString("sv-SE");
}

export default function FileTable({
  files,
  totalCount,
  search,
  onSearchChange,
  loading,
  busyId,
  sortOrder,
  onSortOrderChange,
  page,
  totalPages,
  onPageChange,
  onDownload,
  onDelete,
  onReindex
}: FileTableProps) {
  const { t } = useAppTranslation();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.closest("[data-actions-menu]")) {
        return;
      }
      setOpenMenuId(null);
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const totalLabel = useMemo(() => {
    if (totalCount === 1) {
      return t("admin.fileTable.countOne");
    }
    return t("admin.fileTable.countOther", { count: totalCount });
  }, [t, totalCount]);

  function statusPresentation(status: KnowledgeFileRow["status"]) {
    if (status === "PENDING") {
      return {
        label: t("admin.fileTable.status.pending"),
        className: "bg-slate-100 text-slate-700"
      };
    }
    if (status === "PROCESSING") {
      return {
        label: t("admin.fileTable.status.processing"),
        className: "bg-amber-100 text-amber-700"
      };
    }
    if (status === "READY") {
      return {
        label: t("admin.fileTable.status.ready"),
        className: "bg-emerald-100 text-emerald-700"
      };
    }
    if (status === "ERROR") {
      return {
        label: t("admin.fileTable.status.error"),
        className: "bg-red-100 text-red-700"
      };
    }
    return {
      label: t("admin.fileTable.status.error"),
      className: "bg-red-100 text-red-700"
    };
  }

  return (
    <section className="rounded-[30px] border border-[#e8eaf1] bg-[#fcfdff] px-4 py-5 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.65)] md:px-6 md:py-6">
      <div className="mb-5">
        <h2 className="m-0 text-[1.9rem] font-bold tracking-[-0.02em] text-[#0f172a]">
          {t("admin.fileTable.title")}
        </h2>
      </div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 w-full flex-1">
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
                  d="M13.125 13.125L17 17M15.3333 8.66667C15.3333 12.3486 12.3486 15.3333 8.66667 15.3333C4.98477 15.3333 2 12.3486 2 8.66667C2 4.98477 4.98477 2 8.66667 2C12.3486 2 15.3333 8.66667 15.3333 8.66667Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            }
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("admin.knowledge.searchPlaceholder")}
            wrapperClassName="rounded-2xl border-[#eef1f6] bg-[#f6f8fc] px-4 py-0"
            className="py-3 text-sm"
            aria-label={t("admin.knowledge.searchAriaLabel")}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
          <div className="flex items-center gap-3">
            <p className="m-0 whitespace-nowrap text-sm text-[#667085]">{totalLabel}</p>
            {loading ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-[#eef2ff] px-3 py-1.5 text-sm text-[#4338ca]">
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-[#a5b4fc] border-t-[#4338ca]" />
                {t("admin.fileTable.refreshing")}
              </span>
            ) : null}
          </div>
          <label className="inline-flex items-center gap-3 rounded-2xl border border-[#eef2f7] bg-[#f6f8fc] px-4 py-2.5 text-sm font-medium text-[#6b7280] shadow-[0_12px_28px_-24px_rgba(15,23,42,0.45)]">
            <span>{t("admin.fileTable.sortBy")}</span>
            <span className="relative inline-flex min-w-[92px] items-center">
              <select
                value={sortOrder}
                onChange={(event) =>
                  onSortOrderChange(event.target.value === "oldest" ? "oldest" : "newest")
                }
                className="h-10 w-full appearance-none rounded-xl border border-[#e8ecf4] bg-white px-3 pr-10 text-sm font-semibold text-[#1f2937] shadow-[0_8px_20px_-18px_rgba(15,23,42,0.45)] outline-none transition hover:border-[#d7ddea] focus:border-[#f28c28] focus:ring-2 focus:ring-[#fde6d2]"
              >
                <option value="newest">{t("admin.fileTable.newest")}</option>
                <option value="oldest">{t("admin.fileTable.oldest")}</option>
              </select>
              <span className="pointer-events-none absolute right-3 text-[#475467]">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M5 7.5L10 12.5L15 7.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {files.map((file) => {
          const status = statusPresentation(file.status);
          const isBusy = busyId === file.id;
          return (
            <article key={file.id} className="rounded-2xl border border-[#edf0f5] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="m-0 break-words text-base font-semibold text-[#1f2937]">{file.displayName ?? file.filename}</h3>
                  <p className="mt-1 text-sm text-[#667085]">
                    {formatBytes(file.size)} · {formatDate(file.createdAt)}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-semibold", status.className)}>
                  {status.label}
                </span>
              </div>
              <p className="mt-3 text-sm text-[#667085]">
                {t("admin.fileTable.columns.chunks")}: {file.chunkCount ?? "-"}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button type="button" disabled={isBusy} className="rounded-xl border border-[#e5e7eb] px-2 py-2 text-sm" onClick={() => void onReindex(file.id)}>
                  {t("admin.fileTable.actions.reindex")}
                </button>
                <button type="button" disabled={isBusy} className="rounded-xl border border-[#e5e7eb] px-2 py-2 text-sm" onClick={() => void onDownload(file.id)}>
                  {t("admin.fileTable.actions.save")}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  className="rounded-xl border border-red-200 px-2 py-2 text-sm text-[#b42318]"
                  onClick={() => {
                    if (window.confirm(t("admin.fileTable.confirmDelete", { name: file.displayName ?? file.filename }))) {
                      void onDelete(file.id);
                    }
                  }}
                >
                  {t("admin.fileTable.actions.delete")}
                </button>
              </div>
            </article>
          );
        })}
        {files.length === 0 ? (
          <div className="rounded-2xl border border-[#edf0f5] bg-white px-5 py-12 text-center">
            <p className="m-0 font-semibold text-[#344054]">{t("admin.fileTable.emptyTitle")}</p>
            <p className="mt-2 text-sm text-[#667085]">{t("admin.fileTable.emptyDescription")}</p>
          </div>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-[#edf0f5] bg-white md:block">
        <div className="max-h-[410px] overflow-y-auto pr-1">
          <table className="w-full min-w-[740px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#fafbfe]">
              <tr className="border-b border-[#eef1f5]">
                <th className="px-4 py-4 text-left text-sm font-semibold text-[#98a2b3]">{t("admin.fileTable.columns.name")}</th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-[#98a2b3]">{t("admin.fileTable.columns.size")}</th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-[#98a2b3]">{t("admin.fileTable.columns.uploadedAt")}</th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-[#98a2b3]">{t("admin.fileTable.columns.status")}</th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-[#98a2b3]">{t("admin.fileTable.columns.chunks")}</th>
                <th className="px-4 py-4 text-right text-sm font-semibold text-[#98a2b3]">{t("admin.fileTable.columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => {
                const status = statusPresentation(file.status);
                const isBusy = busyId === file.id;

                return (
                  <tr
                    key={file.id}
                    className="border-b border-[#eef1f5] text-[1.02rem] text-[#1f2937] transition-colors hover:bg-[#fafbff]"
                  >
                    <td className="px-4 py-4 font-medium">{file.displayName ?? file.filename}</td>
                    <td className="px-4 py-4 whitespace-nowrap">{formatBytes(file.size)}</td>
                    <td className="px-4 py-4 whitespace-nowrap">{formatDate(file.createdAt)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-3 py-1 text-sm font-semibold",
                          status.className
                        )}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">{file.chunkCount ?? "-"}</td>
                    <td className="px-4 py-4">
                      <div className="relative flex justify-end" data-actions-menu>
                        <button
                          type="button"
                          aria-label={t("admin.fileTable.openActions")}
                          disabled={isBusy}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-[#111827] transition hover:border-[#e5e7eb] hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() =>
                            setOpenMenuId((current) => (current === file.id ? null : file.id))
                          }
                        >
                          <span className="text-lg leading-none">⋮</span>
                        </button>
                        {openMenuId === file.id ? (
                          <div className="absolute right-0 top-11 z-20 min-w-[190px] rounded-2xl border border-[#e4e7ec] bg-white p-2 shadow-[0_16px_38px_-28px_rgba(16,24,40,0.9)]">
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[0.95rem] text-[#1f2937] transition hover:bg-[#f5f7fb]"
                              onClick={async () => {
                                setOpenMenuId(null);
                                await onReindex(file.id);
                              }}
                            >
                              {t("admin.fileTable.actions.reindex")}
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[0.95rem] text-[#1f2937] transition hover:bg-[#f5f7fb]"
                              onClick={async () => {
                                setOpenMenuId(null);
                                await onDownload(file.id);
                              }}
                            >
                              {t("admin.fileTable.actions.save")}
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[0.95rem] text-[#b42318] transition hover:bg-[#fff3f2]"
                              onClick={async () => {
                                setOpenMenuId(null);
                                const confirmed = window.confirm(
                                  t("admin.fileTable.confirmDelete", { name: file.displayName ?? file.filename })
                                );
                                if (!confirmed) return;
                                await onDelete(file.id);
                              }}
                            >
                              {t("admin.fileTable.actions.delete")}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {files.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                      <p className="m-0 text-lg font-semibold text-[#344054]">
                        {t("admin.fileTable.emptyTitle")}
                      </p>
                      <p className="mt-2 max-w-[380px] text-sm text-[#667085]">
                        {t("admin.fileTable.emptyDescription")}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      {totalPages > 1 ? (
        <nav className="mt-5 flex flex-wrap items-center justify-between gap-3" aria-label={t("admin.fileTable.pagination.label")}>
          <button
            type="button"
            disabled={page <= 1 || loading}
            className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-semibold text-[#344054] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            {t("admin.fileTable.pagination.previous")}
          </button>
          <span className="text-sm text-[#667085]">
            {t("admin.fileTable.pagination.page", { page, totalPages })}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-semibold text-[#344054] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          >
            {t("admin.fileTable.pagination.next")}
          </button>
        </nav>
      ) : null}
    </section>
  );
}

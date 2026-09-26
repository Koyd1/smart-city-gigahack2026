"use client";

import { useEffect, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppTranslation } from "@/lib/i18n/I18nProvider";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  order: number;
  isActive: boolean;
  updatedAt: string;
};

type Draft = {
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
};

function createEmptyDraft(order = 1): Draft {
  return {
    question: "",
    answer: "",
    category: "",
    order,
    isActive: true
  };
}

function createDraftFromItem(item: FaqItem): Draft {
  return {
    question: item.question,
    answer: item.answer,
    category: item.category ?? "",
    order: item.order,
    isActive: item.isActive
  };
}

async function readFaqApiError(response: Response, fallback: string, invalidPayload: string) {
  const payload = await response.json().catch(() => null);
  const message =
    (payload && typeof payload === "object" && "error" in payload && payload.error) ||
    (payload && typeof payload === "object" && "detail" in payload && payload.detail);

  if (typeof message === "string" && message.trim()) {
    if (message === "Invalid payload") {
      return invalidPayload;
    }
    return fallback;
  }

  return fallback;
}

export default function FaqEditor() {
  const { t } = useAppTranslation();
  const [items, setItems] = useState<FaqItem[]>([]);
  const [draft, setDraft] = useState<Draft>(createEmptyDraft());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<FaqItem | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(createEmptyDraft());

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        if (left.order !== right.order) {
          return left.order - right.order;
        }
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      }),
    [items]
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/faq", { cache: "no-store" });
      if (!response.ok) throw new Error(t("admin.faq.loadFailed"));
      const payload = (await response.json()) as { items: FaqItem[] };
      setItems(payload.items);
    } catch {
      setError(t("admin.faq.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.closest("[data-faq-menu]")) {
        return;
      }
      setOpenMenuId(null);
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  async function createItem() {
    setBusyId("create");
    setError(null);
    try {
      const response = await fetch("/api/admin/faq", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft)
      });
      if (!response.ok) {
        throw new Error(
          await readFaqApiError(
            response,
            t("admin.faq.createFailed"),
            t("admin.faq.invalidPayload")
          )
        );
      }
      setDraft(createEmptyDraft());
      setIsCreateOpen(false);
      await load();
    } catch {
      setError(t("admin.faq.createFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function patchItem(id: string, patch: Partial<Draft>) {
    setBusyId(id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/faq/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch)
      });

      if (!response.ok) {
        throw new Error(
          await readFaqApiError(
            response,
            t("admin.faq.updateFailed"),
            t("admin.faq.invalidPayload")
          )
        );
      }

      await load();
      return true;
    } catch {
      setError(t("admin.faq.updateFailed"));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function deleteItem(id: string) {
    const confirmed = window.confirm(t("admin.faq.confirmDelete"));
    if (!confirmed) return;

    setBusyId(id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/faq/${id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error(t("admin.faq.deleteFailed"));
      }

      await load();
    } catch {
      setError(t("admin.faq.deleteFailed"));
    } finally {
      setBusyId(null);
    }
  }

  function openEditDialog(item: FaqItem) {
    setEditingItem(item);
    setEditDraft(createDraftFromItem(item));
  }

  function closeEditDialog() {
    setEditingItem(null);
    setEditDraft(createEmptyDraft());
  }

  async function saveEditedItem() {
    if (!editingItem) {
      return;
    }

    const success = await patchItem(editingItem.id, editDraft);
    if (success) {
      closeEditDialog();
    }
  }

  function resetEditor() {
    setDraft(createEmptyDraft());
    setIsCreateOpen(false);
  }

  function toggleCreateEditor() {
    if (isCreateOpen) {
      resetEditor();
      return;
    }

    setDraft(createEmptyDraft());
    setIsCreateOpen(true);
  }

  function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return date.toLocaleDateString("sv-SE");
  }

  function subtitle(item: FaqItem) {
    if (item.category && item.category.trim().length > 0) {
      return t("admin.faq.categoryPrefix", { category: item.category });
    }
    return t("admin.faq.subtitleFallback");
  }

  return (
    <section className="space-y-6">
      <section className="w-full pt-3">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[760px]">
            <h1 className="m-0 text-[2.25rem] font-bold tracking-[-0.02em] text-[#111827] md:text-[2.75rem]">
              {t("admin.faq.title")}
            </h1>
            <p className="mt-3 text-lg leading-relaxed text-[#6b7280]">
              {t("admin.faq.description")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            {loading ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-[#eef2ff] px-3 py-1.5 text-sm text-[#4338ca]">
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-[#a5b4fc] border-t-[#4338ca]" />
                {t("admin.faq.refresh")}
              </span>
            ) : null}
            <Button
              type="button"
              size="md"
              className="h-11 px-6 text-base"
              onClick={toggleCreateEditor}
            >
              <span className="text-lg leading-none">+</span>
              {isCreateOpen ? t("admin.faq.hideForm") : t("admin.faq.createFaq")}
            </Button>
          </div>
        </div>
        {error ? <Alert variant="error" className="mt-6 max-w-[760px]">{error}</Alert> : null}
      </section>

      {isCreateOpen ? (
        <section className="rounded-[24px] border border-[#eceff5] bg-white p-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.85)] md:p-6">
          <h2 className="m-0 text-xl font-semibold text-[#101828]">{t("admin.faq.newTitle")}</h2>
          <form
            className="mt-4 grid gap-3 md:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              await createItem();
            }}
          >
            <Input
              placeholder={t("admin.faq.fields.question")}
              value={draft.question}
              onChange={(event) => setDraft((prev) => ({ ...prev, question: event.target.value }))}
              className="bg-white md:col-span-2"
            />
            <Textarea
              placeholder={t("admin.faq.fields.answer")}
              value={draft.answer}
              onChange={(event) => setDraft((prev) => ({ ...prev, answer: event.target.value }))}
              className="min-h-[110px] bg-white md:col-span-2"
            />
            <Input
              placeholder={t("admin.faq.fields.category")}
              value={draft.category}
              onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value }))}
              className="bg-white"
            />
            <Input
              type="number"
              placeholder={t("admin.faq.fields.order")}
              value={draft.order}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  order: Number.isNaN(Number(event.target.value))
                    ? prev.order
                    : Number(event.target.value)
                }))
              }
              className="bg-white"
            />
            <label className="inline-flex items-center gap-2 text-sm text-[#334155] md:col-span-2">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    isActive: event.target.checked
                  }))
                }
              />
              {t("admin.faq.fields.active")}
            </label>
            <div className="flex items-center gap-2 md:col-span-2">
              <Button type="submit" disabled={busyId === "create"}>
                {busyId === "create" ? t("admin.faq.creating") : t("admin.faq.create")}
              </Button>
              <Button type="button" variant="ghost" onClick={resetEditor}>
                {t("admin.faq.cancel")}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <Dialog
        open={editingItem !== null}
        onClose={() => {
          if (editingItem && busyId === editingItem.id) {
            return;
          }
          closeEditDialog();
        }}
        title={t("admin.faq.editTitle")}
        description={t("admin.faq.editDescription")}
        panelClassName="max-w-[680px]"
      >
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            await saveEditedItem();
          }}
        >
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-[#344054]">{t("admin.faq.fields.question")}</span>
            <Input
              placeholder={t("admin.faq.fields.question")}
              value={editDraft.question}
              onChange={(event) =>
                setEditDraft((prev) => ({ ...prev, question: event.target.value }))
              }
              className="bg-white"
            />
          </label>

          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-[#344054]">{t("admin.faq.fields.answer")}</span>
            <Textarea
              placeholder={t("admin.faq.fields.answer")}
              value={editDraft.answer}
              onChange={(event) =>
                setEditDraft((prev) => ({ ...prev, answer: event.target.value }))
              }
              rows={5}
              className="min-h-[140px] bg-white"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-medium text-[#344054]">{t("admin.faq.fields.category")}</span>
            <Input
              placeholder={t("admin.faq.fields.category")}
              value={editDraft.category}
              onChange={(event) =>
                setEditDraft((prev) => ({ ...prev, category: event.target.value }))
              }
              className="bg-white"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-medium text-[#344054]">{t("admin.faq.fields.order")}</span>
            <Input
              type="number"
              min={0}
              max={9999}
              value={editDraft.order}
              onChange={(event) =>
                setEditDraft((prev) => ({
                  ...prev,
                  order: Number.isNaN(Number(event.target.value))
                    ? prev.order
                    : Number(event.target.value)
                }))
              }
              className="bg-white"
            />
          </label>

          <label className="inline-flex items-center gap-2 rounded-xl border border-[#e4e7ec] bg-[#f8fafc] px-3.5 py-3 text-sm text-[#344054] md:col-span-2">
            <input
              type="checkbox"
              checked={editDraft.isActive}
              onChange={(event) =>
                setEditDraft((prev) => ({ ...prev, isActive: event.target.checked }))
              }
              className="accent-orange-500"
            />
            {t("admin.faq.fields.active")}
          </label>

          <div className="mt-1 flex flex-wrap items-center justify-end gap-2 md:col-span-2">
            <Button
              type="button"
              variant="secondary"
              onClick={closeEditDialog}
              disabled={editingItem ? busyId === editingItem.id : false}
            >
              {t("admin.faq.cancel")}
            </Button>
            <Button type="submit" disabled={editingItem ? busyId === editingItem.id : false}>
              {editingItem && busyId === editingItem.id ? t("admin.faq.saving") : t("admin.faq.save")}
            </Button>
          </div>
        </form>
      </Dialog>

      <section className="space-y-3">
        {sortedItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d5dae1] bg-white/65 p-5 text-[#6b7280]">
            {t("admin.faq.empty")}
          </div>
        ) : null}

        {sortedItems.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-[#eceff5] bg-white px-4 py-4 shadow-[0_15px_34px_-44px_rgba(15,23,42,0.9)] md:px-5"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 space-y-1">
                <h3 className="m-0 text-base font-semibold text-[#101828]">{item.question}</h3>
                <p className="m-0 text-sm text-[#667085]">{subtitle(item)}</p>
                <p className="m-0 whitespace-pre-wrap text-sm text-[#344054]">{item.answer}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[#667085]">
                  <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5">{t("admin.faq.orderBadge", { order: item.order })}</span>
                  <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5">
                    {item.isActive ? t("admin.faq.activeBadge") : t("admin.faq.inactiveBadge")}
                  </span>
                  <span>{t("admin.faq.updatedAt", { date: formatDate(item.updatedAt) })}</span>
                </div>
              </div>

              <div className="relative" data-faq-menu>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpenMenuId((prev) => (prev === item.id ? null : item.id))}
                >
                  {t("admin.faq.actions")}
                </Button>
                {openMenuId === item.id ? (
                  <div className="absolute right-0 top-10 z-20 min-w-44 rounded-xl border border-[#e5e7eb] bg-white p-2 shadow-lg">
                    <button
                      type="button"
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#1f2937] hover:bg-[#f3f4f6]"
                      onClick={async () => {
                        setOpenMenuId(null);
                        openEditDialog(item);
                      }}
                    >
                      {t("admin.faq.edit")}
                    </button>
                    <button
                      type="button"
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#1f2937] hover:bg-[#f3f4f6]"
                      onClick={async () => {
                        setOpenMenuId(null);
                        await patchItem(item.id, { isActive: !item.isActive });
                      }}
                    >
                      {item.isActive ? t("admin.faq.deactivate") : t("admin.faq.activate")}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                      onClick={async () => {
                        setOpenMenuId(null);
                        await deleteItem(item.id);
                      }}
                    >
                      {busyId === item.id ? t("admin.faq.deleting") : t("admin.faq.delete")}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}

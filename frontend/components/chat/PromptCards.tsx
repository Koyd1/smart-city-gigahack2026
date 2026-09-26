"use client";

import { useEffect, useState } from "react";

import {
  getCachedPromptTemplates,
  loadPromptTemplates,
  type PromptTemplate
} from "@/lib/chatSuggestionsCache";
import { useAppTranslation } from "@/lib/i18n/I18nProvider";

export default function PromptCards({
  onPick,
  layout = "row",
  activeId = null
}: {
  onPick: (item: PromptTemplate) => void;
  layout?: "row" | "grid";
  activeId?: string | null;
}) {
  const { t } = useAppTranslation();
  const [items, setItems] = useState<PromptTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = getCachedPromptTemplates();
    if (cached) {
      setItems(cached);
      setLoading(false);
    }

    async function load() {
      setError(null);
      try {
        const freshItems = await loadPromptTemplates({ force: !cached });
        setItems(freshItems);
      } catch {
        setError(t("chat.prompts.loadFailed"));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{t("chat.prompts.empty")}</p>;
  }

  const containerClass =
    layout === "grid" ? "grid gap-4 sm:grid-cols-2" : "flex gap-3 overflow-x-auto pb-1";
  const buttonClass =
    layout === "grid"
      ? "w-full rounded-2xl border border-border bg-card px-5 py-4 text-center text-sm font-semibold text-slate-700 shadow-[0_12px_26px_rgba(15,23,42,0.08)] transition hover:border-[#087dbb] hover:text-slate-900"
      : "whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition hover:border-slate-300 hover:text-slate-900";

  if (loading) {
    return <p className="text-sm text-slate-400">{t("common.states.loading")}</p>;
  }

  return (
    <div className={containerClass}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.content}
          onClick={() => onPick(item)}
          className={`${buttonClass} ${
            activeId === item.id
              ? "border-[#087dbb] bg-orange-50/80 text-slate-900 shadow-[0_12px_30px_rgba(8,125,187,0.18)]"
              : ""
          }`}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
}

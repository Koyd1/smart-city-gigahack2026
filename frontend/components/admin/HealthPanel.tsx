"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAppTranslation, useLocale } from "@/lib/i18n/I18nProvider";
import { toHtmlLang } from "@/lib/i18n/config";

type ServiceStatus = {
  ok: boolean;
  latencyMs: number;
  detail?: string;
  model?: string;
  chunkCount?: number;
  messageCount?: number;
};

type UsageSummary = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  spendUsd: number;
  avgLatencyMs?: number | null;
};

type UsageWindow = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  spendUsd: number;
  avgLatencyMs?: number | null;
};

type UsageRow = {
  operation?: string | null;
  model?: string | null;
  requests: number;
  exactTokens: number;
  estimatedTokens: number;
  totalTokens: number;
  costTotalUsd: number;
  avgLatencyMs?: number | null;
  missingPricing: boolean;
};

type QualityWindow = {
  messages: number;
  avgHallScore: number;
  p95HallScore: number;
  judgedSamples: number;
  heuristicSamples: number;
  highRiskCount: number;
  negativeFeedbackOverlapCount: number;
};

type RiskyAnswer = {
  messageId: string;
  sessionId: string;
  createdAt: string;
  model: string;
  hallScore: number;
  hallReason: string;
  hallScoreSource: string;
  feedbackRating?: number | null;
  answerExcerpt: string;
};

type HealthPayload = {
  status: "ok" | "warn" | "error" | "unavailable";
  timestamp?: string;
  services: {
    status: "ok" | "warn" | "error";
    openai: ServiceStatus;
    redis: ServiceStatus;
    database: ServiceStatus;
  };
  usage: {
    status: "ok" | "warn" | "error";
    windows: Record<"24h" | "7d" | "30d", UsageWindow>;
    trends30d: Array<{
      day: string;
      exactTokens: number;
      exactSpendUsd: number;
      requests: number;
    }>;
    operations30d: UsageRow[];
    models30d: UsageRow[];
  };
  quality: {
    status: "ok" | "warn" | "error";
    windows: Record<"24h" | "7d" | "30d", QualityWindow>;
    trends30d: Array<{
      day: string;
      avgHallScore: number;
      p95HallScore: number;
      judgedSamples: number;
      heuristicSamples: number;
      highRiskCount: number;
      negativeFeedbackCount: number;
    }>;
    reasonBreakdown30d: Array<{ reason: string; count: number }>;
    riskBuckets30d: Array<{ bucket: string; count: number }>;
    riskyAnswers: RiskyAnswer[];
  };
  coverage: {
    status: "ok" | "warn" | "error";
    telemetryCoverage30d: {
      assistantMessages: number;
      withExactUsage: number;
      withoutUsage: number;
      coveragePct: number;
    };
    judgeCoverage30d: {
      assistantMessages: number;
      judged: number;
      heuristicOnly: number;
      coveragePct: number;
    };
    missingPricingModels: string[];
    lastExactUsageEventAt?: string | null;
  };
};

const POLL_MS = 30000;

type TranslateParams = Record<string, string | number>;
type TranslateFn = (key: string, params?: TranslateParams) => string;

function asBadge(
  status: HealthPayload["status"] | "ok" | "warn" | "error",
  t: TranslateFn,
) {
  if (status === "ok") {
    return { text: t("admin.healthPanel.badge.ok"), color: "#166534", bg: "#dcfce7" };
  }
  if (status === "warn") {
    return { text: t("admin.healthPanel.badge.warn"), color: "#92400e", bg: "#fef3c7" };
  }
  if (status === "unavailable") {
    return { text: t("admin.healthPanel.badge.unavailable"), color: "#475467", bg: "#f2f4f7" };
  }
  return { text: t("admin.healthPanel.badge.error"), color: "#991b1b", bg: "#fee2e2" };
}

function formatNumber(value: number | null | undefined, locale: string, fallback: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return new Intl.NumberFormat(locale).format(value);
}

function formatDecimal(
  value: number | null | undefined,
  locale: string,
  digits: number,
  fallback: string,
) {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatUsd(value: number | null | undefined, locale: string, fallback: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  const fractionDigits = value >= 1 ? 2 : 4;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatPct(value: number | null | undefined, locale: string, fallback: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value) + "%";
}

function formatDate(value: string | null | undefined, locale: string, fallback: string) {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function emptyUsageWindow(): UsageWindow {
  return {
    requests: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    spendUsd: 0,
  };
}

function emptyQualityWindow(): QualityWindow {
  return {
    messages: 0,
    avgHallScore: 0,
    p95HallScore: 0,
    judgedSamples: 0,
    heuristicSamples: 0,
    highRiskCount: 0,
    negativeFeedbackOverlapCount: 0,
  };
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-[#e9edf5] bg-[#fbfcff] p-4">
      <h4 className="m-0 text-xs font-semibold uppercase tracking-[0.06em] text-[#98a2b3]">{label}</h4>
      <p className="mt-2 text-[1.8rem] font-bold text-[#111827]">{value}</p>
      <p className="m-0 text-sm text-[#667085]">{hint}</p>
    </article>
  );
}

function trimReason(reason: string, max = 150) {
  if (reason.length <= max) return reason;
  return `${reason.slice(0, max).trimEnd()}...`;
}

function ServiceCard({
  title,
  body,
  extra,
  locale,
  notAvailable,
  t,
}: {
  title: string;
  body?: ServiceStatus;
  extra?: string | null;
  locale: string;
  notAvailable: string;
  t: TranslateFn;
}) {
  return (
    <article className="rounded-2xl border border-[#e9edf5] bg-[#fbfcff] p-4">
      <h4 className="m-0 text-sm font-semibold uppercase tracking-[0.06em] text-[#98a2b3]">{title}</h4>
      <p className="mt-2 text-lg font-bold text-[#111827]">
        {body?.ok ? t("admin.healthPanel.services.statusOk") : t("admin.healthPanel.services.statusFail")}
      </p>
      <p className="m-0 text-sm text-[#667085]">
        {t("admin.healthPanel.services.latency", {
          value: body?.latencyMs !== undefined ? formatNumber(body.latencyMs, locale, notAvailable) : notAvailable,
        })}
      </p>
      {extra ? <p className="m-0 mt-1 text-sm text-[#667085]">{extra}</p> : null}
      {body?.detail ? <p className="m-0 mt-1 text-sm text-[#b54708]">{body.detail}</p> : null}
    </article>
  );
}

function WindowTable({
  usage,
  quality,
  locale,
  notAvailable,
  t,
}: {
  usage: Record<"24h" | "7d" | "30d", UsageWindow>;
  quality: Record<"24h" | "7d" | "30d", QualityWindow>;
  locale: string;
  notAvailable: string;
  t: TranslateFn;
}) {
  const rows: Array<"24h" | "7d" | "30d"> = ["24h", "7d", "30d"];

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#edf0f5] bg-white">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="bg-[#fafbfe]">
          <tr className="border-b border-[#eef1f5]">
            <th className="px-4 py-3 text-left font-semibold text-[#98a2b3]">
              {t("admin.healthPanel.usage.windowTable.columns.window")}
            </th>
            <th className="px-4 py-3 text-left font-semibold text-[#98a2b3]">
              {t("admin.healthPanel.usage.windowTable.columns.tokens")}
            </th>
            <th className="px-4 py-3 text-left font-semibold text-[#98a2b3]">
              {t("admin.healthPanel.usage.windowTable.columns.avgRisk")}
            </th>
            <th className="px-4 py-3 text-left font-semibold text-[#98a2b3]">
              {t("admin.healthPanel.usage.windowTable.columns.judged")}
            </th>
            <th className="px-4 py-3 text-left font-semibold text-[#98a2b3]">
              {t("admin.healthPanel.usage.windowTable.columns.needsReview")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((label) => (
            <tr key={label} className="border-b border-[#eef1f5] text-[#1f2937]">
              <td className="px-4 py-3 font-medium">{label}</td>
              <td className="px-4 py-3">{formatNumber(usage[label].totalTokens, locale, notAvailable)}</td>
              <td className="px-4 py-3">
                {formatDecimal(quality[label].avgHallScore, locale, 3, notAvailable)}
              </td>
              <td className="px-4 py-3">
                {formatNumber(quality[label].judgedSamples, locale, notAvailable)}
              </td>
              <td className="px-4 py-3">
                {formatNumber(quality[label].highRiskCount, locale, notAvailable)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModelTable({
  rows,
  locale,
  notAvailable,
  t,
}: {
  rows: UsageRow[];
  locale: string;
  notAvailable: string;
  t: TranslateFn;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#edf0f5] bg-white">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead className="bg-[#fafbfe]">
          <tr className="border-b border-[#eef1f5]">
            <th className="px-4 py-3 text-left font-semibold text-[#98a2b3]">
              {t("admin.healthPanel.usage.modelTable.columns.model")}
            </th>
            <th className="px-4 py-3 text-left font-semibold text-[#98a2b3]">
              {t("admin.healthPanel.usage.modelTable.columns.operation")}
            </th>
            <th className="px-4 py-3 text-left font-semibold text-[#98a2b3]">
              {t("admin.healthPanel.usage.modelTable.columns.tokens")}
            </th>
            <th className="px-4 py-3 text-left font-semibold text-[#98a2b3]">
              {t("admin.healthPanel.usage.modelTable.columns.spend")}
            </th>
            <th className="px-4 py-3 text-left font-semibold text-[#98a2b3]">
              {t("admin.healthPanel.usage.modelTable.columns.latency")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 6).map((row) => (
            <tr
              key={`${row.model ?? "unknown"}-${row.operation ?? "unknown"}`}
              className="border-b border-[#eef1f5] text-[#1f2937]"
            >
              <td className="px-4 py-3">{row.model ?? notAvailable}</td>
              <td className="px-4 py-3">{row.operation ?? notAvailable}</td>
              <td className="px-4 py-3">
                {formatNumber(row.totalTokens, locale, notAvailable)}
              </td>
              <td className="px-4 py-3">
                {formatUsd(row.costTotalUsd, locale, notAvailable)}
                {row.missingPricing ? (
                  <span className="ml-2 text-xs text-[#b54708]">
                    {t("admin.healthPanel.usage.modelTable.pricingGap")}
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3">
                {row.avgLatencyMs !== null && row.avgLatencyMs !== undefined
                  ? t("admin.healthPanel.format.milliseconds", {
                      value: formatNumber(row.avgLatencyMs, locale, notAvailable),
                    })
                  : notAvailable}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-10 text-center text-sm text-[#98a2b3]">
                {t("admin.healthPanel.usage.modelTable.noData")}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function HealthPanel() {
  const { t } = useAppTranslation();
  const { locale } = useLocale();
  const [data, setData] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intlLocale = toHtmlLang(locale);
  const notAvailable = t("admin.healthPanel.fallback.notAvailable");
  const translate: TranslateFn = (key, params) => String(t(key, params));

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(translate("admin.healthPanel.errors.loadFailed"));
        }
        const payload = (await response.json()) as HealthPayload;
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setData(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : translate("admin.healthPanel.errors.loadGeneric"),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const badge = useMemo(
    () => asBadge(data?.status ?? "unavailable", translate),
    [data?.status, translate],
  );

  const usage24h = data?.usage.windows["24h"] ?? emptyUsageWindow();
  const usage30d = data?.usage.windows["30d"] ?? emptyUsageWindow();
  const quality30d = data?.quality.windows["30d"] ?? emptyQualityWindow();
  const latestRisk = data?.quality.riskyAnswers?.[0] ?? null;
  const exactEmpty = (data?.coverage.telemetryCoverage30d.withExactUsage ?? 0) === 0;
  const tokenSeriesLabel = t("admin.healthPanel.usage.trend.series");
  const averageSeriesLabel = t("admin.healthPanel.quality.trend.averageSeries");
  const p95SeriesLabel = t("admin.healthPanel.quality.trend.p95Series");
  const trendData = (data?.usage.trends30d ?? []).map((item) => ({
    day: item.day.slice(5),
    [tokenSeriesLabel]: item.exactTokens,
  }));
  const qualityTrendData = (data?.quality.trends30d ?? []).map((item) => ({
    day: item.day.slice(5),
    [averageSeriesLabel]: item.avgHallScore,
    [p95SeriesLabel]: item.p95HallScore,
  }));

  return (
    <section className="space-y-7">
      <section className="rounded-[30px] border border-[#e8eaf1] bg-white px-5 py-6 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.65)] md:px-7">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="m-0 text-[1.7rem] font-bold tracking-[-0.02em] text-[#111827]">
              {t("admin.healthPanel.hero.title")}
            </h2>
            <p className="mt-2 text-sm text-[#667085]">
              {t("admin.healthPanel.hero.description")}
            </p>
          </div>
          <span
            className="w-fit rounded-full px-4 py-1.5 text-xs font-bold tracking-[0.06em]"
            style={{ background: badge.bg, color: badge.color }}
          >
            {loading ? t("admin.healthPanel.badge.loading") : badge.text}
          </span>
        </div>

        {error ? (
          <div className="rounded-2xl border border-[#fecaca] bg-[#fff5f5] px-4 py-3 text-sm text-[#991b1b]">
            {error}
          </div>
        ) : null}

        {exactEmpty ? (
          <div className="mb-4 rounded-2xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-sm text-[#9a3412]">
            {t("admin.healthPanel.hero.emptyTelemetry")}
          </div>
        ) : null}

        {data?.coverage.missingPricingModels.length ? (
          <div className="mb-4 rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]">
            {t("admin.healthPanel.hero.missingPricing", {
              models: data.coverage.missingPricingModels.join(", "),
            })}
          </div>
        ) : null}

        <small className="block text-sm text-[#98a2b3]">
          {t("admin.healthPanel.hero.updated", {
            timestamp: formatDate(data?.timestamp, intlLocale, notAvailable),
          })}
        </small>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <ServiceCard
          title={t("admin.healthPanel.services.openai")}
          body={data?.services.openai}
          extra={
            data?.services.openai.model
              ? t("admin.healthPanel.services.model", { value: data.services.openai.model })
              : null
          }
          locale={intlLocale}
          notAvailable={notAvailable}
          t={translate}
        />
        <ServiceCard
          title={t("admin.healthPanel.services.redis")}
          body={data?.services.redis}
          locale={intlLocale}
          notAvailable={notAvailable}
          t={translate}
        />
        <ServiceCard
          title={t("admin.healthPanel.services.database")}
          body={data?.services.database}
          extra={t("admin.healthPanel.services.databaseExtra", {
            chunks: formatNumber(data?.services.database.chunkCount, intlLocale, notAvailable),
            messages: formatNumber(data?.services.database.messageCount, intlLocale, notAvailable),
          })}
          locale={intlLocale}
          notAvailable={notAvailable}
          t={translate}
        />
      </section>

      <section className="rounded-[30px] border border-[#e8eaf1] bg-white px-5 py-6 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.65)] md:px-7">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="m-0 text-[1.35rem] font-bold text-[#111827]">
            {t("admin.healthPanel.usage.title")}
          </h3>
          <span className="text-sm text-[#98a2b3]">{t("admin.healthPanel.usage.summary")}</span>
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          <StatCard
            label={t("admin.healthPanel.usage.cards.tokens24hLabel")}
            value={formatNumber(usage24h.totalTokens, intlLocale, notAvailable)}
            hint={t("admin.healthPanel.usage.cards.tokens24hHint", {
              value: formatNumber(usage24h.requests, intlLocale, notAvailable),
            })}
          />
          <StatCard
            label={t("admin.healthPanel.usage.cards.spend30dLabel")}
            value={formatUsd(usage30d.spendUsd, intlLocale, notAvailable)}
            hint={t("admin.healthPanel.usage.cards.spend30dHint", {
              value: formatNumber(usage30d.totalTokens, intlLocale, notAvailable),
            })}
          />
          <StatCard
            label={t("admin.healthPanel.usage.cards.coverageLabel")}
            value={formatPct(data?.coverage.telemetryCoverage30d.coveragePct, intlLocale, notAvailable)}
            hint={t("admin.healthPanel.usage.cards.coverageHint", {
              exact: formatNumber(data?.coverage.telemetryCoverage30d.withExactUsage, intlLocale, notAvailable),
              assistant: formatNumber(
                data?.coverage.telemetryCoverage30d.assistantMessages,
                intlLocale,
                notAvailable,
              ),
            })}
          />
          <StatCard
            label={t("admin.healthPanel.usage.cards.judgedLabel")}
            value={formatPct(data?.coverage.judgeCoverage30d.coveragePct, intlLocale, notAvailable)}
            hint={t("admin.healthPanel.usage.cards.judgedHint", {
              value: formatNumber(data?.coverage.judgeCoverage30d.judged, intlLocale, notAvailable),
            })}
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-2xl border border-[#edf0f5] bg-[#fbfcff] p-5">
            <h4 className="m-0 text-base font-semibold text-[#111827]">
              {t("admin.healthPanel.usage.trend.title")}
            </h4>
            <p className="m-0 mt-1 text-xs text-[#98a2b3]">
              {t("admin.healthPanel.usage.trend.description")}
            </p>
            <div className="mt-4 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#cbd5e1" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#cbd5e1" />
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey={tokenSeriesLabel} stroke="#f97316" fill="#fed7aa" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-4">
            <WindowTable
              usage={data?.usage.windows ?? { "24h": emptyUsageWindow(), "7d": emptyUsageWindow(), "30d": emptyUsageWindow() }}
              quality={data?.quality.windows ?? { "24h": emptyQualityWindow(), "7d": emptyQualityWindow(), "30d": emptyQualityWindow() }}
              locale={intlLocale}
              notAvailable={notAvailable}
              t={translate}
            />
          </div>
        </div>

        <div className="mt-5">
          <h4 className="mb-3 mt-0 text-base font-semibold text-[#111827]">
            {t("admin.healthPanel.usage.modelBreakdown")}
          </h4>
          <ModelTable
            rows={data?.usage.models30d ?? []}
            locale={intlLocale}
            notAvailable={notAvailable}
            t={translate}
          />
        </div>
      </section>

      <section className="rounded-[30px] border border-[#e8eaf1] bg-white px-5 py-6 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.65)] md:px-7">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="m-0 text-[1.35rem] font-bold text-[#111827]">
            {t("admin.healthPanel.quality.title")}
          </h3>
          <span className="text-sm text-[#98a2b3]">{t("admin.healthPanel.quality.summary")}</span>
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          <StatCard
            label={t("admin.healthPanel.quality.cards.averageRiskLabel")}
            value={formatDecimal(quality30d.avgHallScore, intlLocale, 3, notAvailable)}
            hint={t("admin.healthPanel.quality.cards.averageRiskHint", {
              value: formatDecimal(quality30d.p95HallScore, intlLocale, 3, notAvailable),
            })}
          />
          <StatCard
            label={t("admin.healthPanel.quality.cards.judgedCoverageLabel")}
            value={formatPct(data?.coverage.judgeCoverage30d.coveragePct, intlLocale, notAvailable)}
            hint={t("admin.healthPanel.quality.cards.judgedCoverageHint", {
              value: formatNumber(data?.coverage.judgeCoverage30d.judged, intlLocale, notAvailable),
            })}
          />
          <StatCard
            label={t("admin.healthPanel.quality.cards.needsReviewLabel")}
            value={formatNumber(quality30d.highRiskCount, intlLocale, notAvailable)}
            hint={t("admin.healthPanel.quality.cards.needsReviewHint")}
          />
          <StatCard
            label={t("admin.healthPanel.quality.cards.latestHighScoreLabel")}
            value={latestRisk ? formatDecimal(latestRisk.hallScore, intlLocale, 3, notAvailable) : notAvailable}
            hint={
              latestRisk
                ? t("admin.healthPanel.quality.cards.latestHighScoreHint")
                : t("admin.healthPanel.quality.cards.noLatestHighScoreHint")
            }
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <div className="rounded-2xl border border-[#edf0f5] bg-[#fbfcff] p-5">
            <h4 className="m-0 text-base font-semibold text-[#111827]">
              {t("admin.healthPanel.quality.trend.title")}
            </h4>
            <p className="m-0 mt-1 text-xs text-[#98a2b3]">
              {t("admin.healthPanel.quality.trend.description")}
            </p>
            <div className="mt-4 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={qualityTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#cbd5e1" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#cbd5e1" domain={[0, 1]} />
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey={averageSeriesLabel} stroke="#f97316" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey={p95SeriesLabel} stroke="#ef4444" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-[#edf0f5] bg-[#fffaf5] p-5">
            <h4 className="m-0 text-base font-semibold text-[#111827]">
              {t("admin.healthPanel.quality.interpretation.title")}
            </h4>
            <div className="mt-4 space-y-2 text-sm leading-6 text-[#475467]">
              <p className="m-0">{t("admin.healthPanel.quality.interpretation.line1")}</p>
              <p className="m-0">{t("admin.healthPanel.quality.interpretation.line2")}</p>
              <p className="m-0">{t("admin.healthPanel.quality.interpretation.line3")}</p>
            </div>
            <div className="mt-4 space-y-2">
              {(data?.quality.reasonBreakdown30d ?? []).slice(0, 4).map((item, index) => (
                <div
                  key={item.reason}
                  className="rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-3 py-3 text-sm leading-6 text-[#92400e]"
                >
                  <strong className="mr-2">{index + 1}.</strong>
                  <span className="break-words">{trimReason(item.reason)}</span>
                  <span className="ml-2 whitespace-nowrap text-[#b45309]">× {item.count}</span>
                </div>
              ))}
              {(data?.quality.reasonBreakdown30d ?? []).length === 0 ? (
                <span className="text-sm text-[#98a2b3]">
                  {t("admin.healthPanel.quality.interpretation.noReasons")}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-[#edf0f5] bg-white">
          <table className="w-full min-w-[940px] border-collapse text-sm">
            <thead className="bg-[#fafbfe]">
              <tr className="border-b border-[#eef1f5]">
                <th className="px-4 py-3 text-left font-semibold text-[#98a2b3]">
                  {t("admin.healthPanel.quality.riskyTable.columns.date")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#98a2b3]">
                  {t("admin.healthPanel.quality.riskyTable.columns.model")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#98a2b3]">
                  {t("admin.healthPanel.quality.riskyTable.columns.score")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#98a2b3]">
                  {t("admin.healthPanel.quality.riskyTable.columns.reason")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#98a2b3]">
                  {t("admin.healthPanel.quality.riskyTable.columns.feedback")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#98a2b3]">
                  {t("admin.healthPanel.quality.riskyTable.columns.excerpt")}
                </th>
              </tr>
            </thead>
            <tbody>
              {(data?.quality.riskyAnswers ?? []).slice(0, 8).map((item) => (
                <tr key={item.messageId} className="border-b border-[#eef1f5] align-top text-[#1f2937] hover:bg-[#fafbff]">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(item.createdAt, intlLocale, notAvailable)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.model}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDecimal(item.hallScore, intlLocale, 3, notAvailable)}
                  </td>
                  <td className="max-w-[260px] break-words px-4 py-3">{item.hallReason}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.feedbackRating ?? "—"}</td>
                  <td className="max-w-[420px] break-words px-4 py-3">{item.answerExcerpt}</td>
                </tr>
              ))}
              {(data?.quality.riskyAnswers ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-[#98a2b3]">
                    {t("admin.healthPanel.quality.riskyTable.empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

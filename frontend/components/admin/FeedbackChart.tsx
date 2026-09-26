"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppTranslation } from "@/lib/i18n/I18nProvider";

type Summary = {
  total: number;
  positive: number;
  negative: number;
  positiveRate: number;
};

type Point = {
  day: string;
  total: number;
  positive: number;
  negative: number;
};

export default function FeedbackChart({
  summary,
  series,
}: {
  summary: Summary;
  series: Point[];
}) {
  const { t } = useAppTranslation();
  const negativeRate =
    summary.total > 0 ? 100 - summary.positiveRate : 0;
  const statCards = [
    {
      label: t("admin.feedbackChart.cards.totalReviews"),
      key: "total" as const,
      icon: "/icons/blue_message.svg",
      iconBg: "bg-blue-50",
    },
    {
      label: t("admin.feedbackChart.cards.positive"),
      key: "positiveRate" as const,
      icon: "/icons/like_logo.svg",
      iconBg: "bg-green-50",
      suffix: "%",
    },
    {
      label: t("admin.feedbackChart.cards.negative"),
      key: "negativeRate" as const,
      icon: "/icons/dislike_logo.svg",
      iconBg: "bg-red-50",
      suffix: "%",
    },
    {
      label: t("admin.feedbackChart.cards.comments"),
      key: "comments" as const,
      icon: "/icons/comments_logo.svg",
      iconBg: "bg-yellow-50",
    },
  ] as const;

  const statValues: Record<string, number> = {
    total: summary.total,
    positiveRate: summary.positiveRate,
    negativeRate,
    comments: summary.negative,
  };

  const barData = series.map((p) => ({
    name: p.day.slice(5), // MM-DD
    [t("admin.feedbackChart.lines.positive")]: p.positive,
    [t("admin.feedbackChart.lines.negative")]: p.negative,
  }));

  const lineData = series.map((p) => {
    const total = p.positive + p.negative;
    return {
      name: p.day.slice(5),
      [t("admin.feedbackChart.lines.positivePercent")]:
        total > 0 ? Math.round((p.positive / total) * 100) : 0,
      [t("admin.feedbackChart.lines.negativePercent")]:
        total > 0 ? Math.round((p.negative / total) * 100) : 0,
    };
  });

  const emptyLine = (
    <p className="py-16 text-center text-sm text-gray-400">
      {t("admin.feedbackChart.empty")}
    </p>
  );

  return (
    <div className="space-y-5">
      {/* ── stat cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.key}
            className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
          >
            <div>
              <p className="m-0 text-sm text-gray-500">{card.label}</p>
              <p className="m-0 mt-1 text-3xl font-bold text-gray-900">
                {statValues[card.key]}
                {"suffix" in card ? card.suffix : ""}
              </p>
            </div>
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}
            >
              <img src={card.icon} alt="" className="h-6 w-6" />
            </div>
          </div>
        ))}
      </div>

      {/* ── charts ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="m-0 mb-1 text-base font-semibold text-gray-900">{t("admin.feedbackChart.statsTitle")}</h3>
          <p className="m-0 mb-4 text-xs text-gray-400">{t("admin.feedbackChart.statsDescription")}</p>
          {lineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={lineData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#d1d5db" />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} stroke="#d1d5db" />
                <Tooltip
                  formatter={(value: unknown) => `${value}%`}
                  contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey={t("admin.feedbackChart.lines.positivePercent")}
                  stroke="#2dd4bf"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey={t("admin.feedbackChart.lines.negativePercent")}
                  stroke="#f472b6"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : emptyLine}
        </div>

        {}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="m-0 mb-1 text-base font-semibold text-gray-900">{t("admin.feedbackChart.histogramTitle")}</h3>
          <p className="m-0 mb-4 text-xs text-gray-400">{t("admin.feedbackChart.histogramDescription")}</p>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} barGap={2} barSize={12} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#d1d5db" />
                <YAxis tick={{ fontSize: 11 }} stroke="#d1d5db" />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey={t("admin.feedbackChart.lines.positive")} fill="#fb923c" radius={[4, 4, 0, 0]} />
                <Bar dataKey={t("admin.feedbackChart.lines.negative")} fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : emptyLine}
        </div>
      </div>
    </div>
  );
}

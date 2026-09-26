"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import SourceCard, { type ChatSource } from "@/components/chat/SourceCard";
import FeedbackButtons from "@/components/chat/FeedbackButtons";
import TypingDots from "@/components/chat/TypingDots";
import { useAppTranslation } from "@/lib/i18n/I18nProvider";

export type ChatMessageVM = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  feedbackRating?: 1 | -1;
  feedbackComment?: string | null;
};

type KnowledgeDoc = {
  id: string;
  filename: string;
  snippet?: string | null;
};

function getSourceDownloadUrl(source: ChatSource): string | undefined {
  if (typeof source.url === "string") {
    return source.url;
  }

  if (typeof source.fileId === "string" && /^(https?:)?\/\//.test(source.fileId)) {
    return source.fileId;
  }

  if (typeof source.fileId === "string") {
    return `/api/upload/${source.fileId}/download`;
  }

  return undefined;
}

export default function MessageBubble({
  message,
  sessionId,
  onFeedbackSaved
}: {
  message: ChatMessageVM;
  sessionId: string;
  onFeedbackSaved?: (messageId: string, payload: { rating: 1 | -1; comment: string | null }) => void;
}) {
  const { t } = useAppTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [kbFiles, setKbFiles] = useState<KnowledgeDoc[]>([]);
  const [kbLoaded, setKbLoaded] = useState(false);
  const [kbError, setKbError] = useState<string | null>(null);
  const isUser = message.role === "user";
  const isStreaming = !isUser && message.content.length === 0 && message.id.startsWith("a-");
  const showDetails = !isUser && !isStreaming;
  const showInlineFeedback = !isUser && !isStreaming && !message.id.startsWith("a-");
  const hasSources = !!message.sources && message.sources.length > 0;

  useEffect(() => {
    if (!detailsOpen || hasSources || kbLoaded) return;
    let active = true;

    async function loadFiles() {
      try {
        const response = await fetch("/api/upload", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(t("chat.message.loadSourcesFailed"));
        }
        const payload = (await response.json()) as { items?: KnowledgeDoc[] };
        if (!active) return;
        setKbFiles(payload.items ?? []);
        setKbLoaded(true);
      } catch (loadError) {
        if (!active) return;
        setKbError(t("chat.message.loadSourcesFailed"));
        setKbLoaded(true);
      }
    }

    void loadFiles();

    return () => {
      active = false;
    };
  }, [detailsOpen, hasSources, kbLoaded]);

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="flex w-full min-w-0 max-w-[840px] flex-row-reverse items-start gap-3 sm:gap-4">
          <div className="flex aspect-square h-11 w-11 shrink-0 self-start items-center justify-center overflow-hidden rounded-full bg-[#5ab3df] shadow-[0_10px_22px_rgba(8,125,187,0.2)] ring-1 ring-orange-200 sm:h-12 sm:w-12">
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <path
                d="M12 12c2.485 0 4.5-2.015 4.5-4.5S14.485 3 12 3 7.5 5.015 7.5 7.5 9.515 12 12 12Zm0 2c-3.866 0-7 3.134-7 7h14c0-3.866-3.134-7-7-7Z"
                fill="white"
              />
            </svg>
          </div>
          <div className="min-w-0 w-fit max-w-[calc(100%-3.5rem)] rounded-3xl bg-[#087dbb] px-5 py-3 text-white shadow-[0_12px_30px_rgba(8,125,187,0.28)] sm:max-w-[760px] sm:px-6 sm:py-4">
            <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words hyphens-auto [overflow-wrap:anywhere]">
              {message.content || "..."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 sm:gap-8">
      <div className="flex w-full justify-start">
        <div className="flex w-full min-w-0 max-w-full items-start gap-3 sm:max-w-[900px] sm:gap-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#087dbb] shadow-[0_8px_18px_rgba(15,23,42,0.12)] ring-1 ring-orange-200 sm:h-12 sm:w-12">
            <svg
              viewBox="0 0 44 44"
              fill="none"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path
                d="M36.6849 21.2862H36.4312C35.3896 16.6304 31.232 13.134 26.2682 13.134H23.0979V11.9746C24.674 11.413 25.8153 9.91845 25.8153 8.15214C25.8153 5.90577 23.9856 4.07606 21.7392 4.07606C19.4928 4.07606 17.6631 5.90577 17.6631 8.15214C17.6631 9.91845 18.8044 11.413 20.3805 11.9746V13.134H17.2102C12.2465 13.134 8.08885 16.6304 7.04719 21.2862H6.79356C5.299 21.2862 4.07617 22.509 4.07617 24.0036V26.721C4.07617 28.2155 5.299 29.4384 6.79356 29.4384H7.29175C8.36059 32.7717 11.0599 35.3623 14.4475 36.3043C14.1939 36.8387 14.0399 37.4184 14.0399 38.0434C14.0399 38.7953 14.6468 39.4021 15.3986 39.4021H28.0798C28.8316 39.4021 29.4385 38.7953 29.4385 38.0434C29.4385 37.4184 29.2845 36.8297 29.0309 36.3043C32.4186 35.3713 35.1178 32.7717 36.1867 29.4384H36.6849C38.1794 29.4384 39.4023 28.2155 39.4023 26.721V24.0036C39.4023 22.509 38.1794 21.2862 36.6849 21.2862ZM21.7392 6.79345C22.491 6.79345 23.0979 7.40033 23.0979 8.15214C23.0979 8.90395 22.491 9.51084 21.7392 9.51084C20.9874 9.51084 20.3805 8.90395 20.3805 8.15214C20.3805 7.40033 20.9874 6.79345 21.7392 6.79345ZM26.2682 33.9674H17.2102C12.962 33.9674 9.51095 30.5163 9.51095 26.2681V23.5507C9.51095 19.3025 12.962 15.8514 17.2102 15.8514H26.2682C30.5164 15.8514 33.9675 19.3025 33.9675 23.5507V26.2681C33.9675 30.5163 30.5164 33.9674 26.2682 33.9674Z"
                fill="white"
              />
              <path
                d="M16.7573 19.4746C15.2628 19.4746 14.0399 20.6974 14.0399 22.192V24.9094C14.0399 26.404 15.2628 27.6268 16.7573 27.6268C18.2519 27.6268 19.4747 26.404 19.4747 24.9094V22.192C19.4747 20.6974 18.2519 19.4746 16.7573 19.4746Z"
                fill="white"
              />
              <path
                d="M26.7211 19.4746C25.2265 19.4746 24.0037 20.6974 24.0037 22.192V24.9094C24.0037 26.404 25.2265 27.6268 26.7211 27.6268C28.2157 27.6268 29.4385 26.404 29.4385 24.9094V22.192C29.4385 20.6974 28.2157 19.4746 26.7211 19.4746Z"
                fill="white"
              />
              <path
                d="M12.2555 6.72098L14.9729 7.62678C15.1178 7.67207 15.2628 7.69924 15.3986 7.69924C15.9693 7.69924 16.4946 7.33693 16.6849 6.76627C16.9204 6.05069 16.5399 5.28077 15.8244 5.04526L13.107 4.13946C12.4004 3.90395 11.6305 4.28439 11.386 4.99997C11.1414 5.71555 11.5309 6.48548 12.2465 6.72098H12.2555Z"
                fill="white"
              />
              <path
                d="M12.6812 12.2282C12.8262 12.2282 12.9711 12.2101 13.107 12.1558L15.8244 11.25C16.5399 11.0145 16.9204 10.2445 16.6849 9.52895C16.4494 8.81337 15.6794 8.43294 14.9639 8.66845L12.2465 9.57424C11.5309 9.80975 11.1504 10.5797 11.386 11.2953C11.5762 11.8659 12.1015 12.2282 12.6722 12.2282H12.6812Z"
                fill="white"
              />
              <path
                d="M28.0798 7.69924C28.2247 7.69924 28.3696 7.68113 28.5055 7.62678L31.2229 6.72098C31.9385 6.48548 32.3189 5.71555 32.0834 4.99997C31.8479 4.28439 31.078 3.90395 30.3624 4.13946L27.645 5.04526C26.9294 5.28077 26.549 6.05069 26.7845 6.76627C26.9747 7.33693 27.5001 7.69924 28.0707 7.69924H28.0798Z"
                fill="white"
              />
              <path
                d="M27.6541 11.25L30.3715 12.1558C30.5164 12.2011 30.6613 12.2282 30.7972 12.2282C31.3678 12.2282 31.8932 11.8659 32.0834 11.2953C32.3189 10.5797 31.9385 9.80975 31.2229 9.57424L28.5055 8.66845C27.799 8.43294 27.02 8.81337 26.7845 9.52895C26.549 10.2445 26.9294 11.0145 27.645 11.25H27.6541Z"
                fill="white"
              />
            </svg>
          </div>
          <div className="min-w-0 w-full rounded-3xl border border-border bg-card px-5 py-3 text-slate-800 shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:px-6 sm:py-4">
            <div
              className={`min-w-0 text-[15px] leading-relaxed hyphens-auto [overflow-wrap:anywhere] ${
                isStreaming ? "text-slate-500" : ""
              }`}
            >
              {isStreaming ? (
                <TypingDots className="text-slate-500" label={t("chat.message.assistantTyping")} />
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
                    h1: ({ children }) => <h1 className="my-3 text-xl font-bold">{children}</h1>,
                    h2: ({ children }) => <h2 className="my-3 text-lg font-bold">{children}</h2>,
                    h3: ({ children }) => <h3 className="my-2 text-base font-bold">{children}</h3>,
                    ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-6">{children}</ul>,
                    ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-6">{children}</ol>,
                    li: ({ children }) => <li className="pl-1">{children}</li>,
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#087dbb] underline underline-offset-2 hover:text-[#08679a]"
                      >
                        {children}
                      </a>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="my-3 border-l-2 border-slate-300 pl-4 text-slate-600">
                        {children}
                      </blockquote>
                    ),
                    code: ({ children, className }) => (
                      <code className={`rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] ${className ?? ""}`}>
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className="my-3 max-w-full overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
                        {children}
                      </pre>
                    ),
                    table: ({ children }) => (
                      <div className="my-3 max-w-full overflow-x-auto">
                        <table className="w-full border-collapse text-left">{children}</table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border-b border-slate-300 px-3 py-2 font-semibold">{children}</th>
                    ),
                    td: ({ children }) => <td className="border-b border-slate-200 px-3 py-2">{children}</td>,
                    hr: () => <hr className="my-4 border-slate-200" />
                  }}
                >
                  {message.content || "..."}
                </ReactMarkdown>
              )}
            </div>

            {showDetails ? (
              <div className="mt-4 flex flex-col items-end gap-3">
                <button
                  type="button"
                  onClick={() => setDetailsOpen((prev) => !prev)}
                  disabled={!hasSources}
                  className={`rounded-full border border-border bg-white px-4 py-1 text-xs font-semibold text-slate-600 shadow-[0_6px_14px_rgba(15,23,42,0.08)] transition ${
                    hasSources ? "hover:bg-slate-50 cursor-pointer" : "opacity-50 cursor-not-allowed"
                  }`}
                  aria-expanded={detailsOpen}
                >
                  {t("chat.message.details")}
                </button>

                {detailsOpen ? (
                  <div className="w-full max-w-full sm:max-w-[760px]">
                    {hasSources ? (
                      <div className="grid gap-3">
                        {(message.sources ?? []).map((source, index) => (
                          <SourceCard
                            key={`${message.id}-src-${index}`}
                            source={source}
                            href={getSourceDownloadUrl(source)}
                          />
                        ))}
                      </div>
                    ) : null}

                    {!hasSources ? (
                      <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)] sm:max-w-[420px]">
                        {kbLoaded && kbFiles.length > 0 ? (
                          <div className="flex flex-col gap-3">
                            {kbFiles.slice(0, 2).map((file) => (
                              <div key={file.id}>
                                <a
                                  href={`/api/upload/${file.id}/download`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm font-semibold text-slate-800 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
                                >
                                  {file.filename}
                                </a>
                                {file.snippet ? (
                                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                                    {file.snippet}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : kbLoaded && kbFiles.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            {t("chat.message.noSources")}
                          </p>
                        ) : kbError ? (
                          <p className="text-xs text-red-500">{kbError}</p>
                        ) : (
                          <p className="text-xs text-slate-500">
                            {t("chat.message.loadingSources")}
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {showInlineFeedback ? (
              <div className="mt-5 border-t border-border/80 pt-4">
                <FeedbackButtons
                  sessionId={sessionId}
                  messageId={message.id}
                  initialRating={message.feedbackRating}
                  initialComment={message.feedbackComment}
                  onSaved={(payload) => onFeedbackSaved?.(message.id, payload)}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import MessageBubble, { type ChatMessageVM } from "@/components/chat/MessageBubble";
import FaqCards from "@/components/chat/FaqCards";
import PromptCards from "@/components/chat/PromptCards";
import SessionToggle from "@/components/chat/SessionToggle";
import TypingDots from "@/components/chat/TypingDots";
import type { ChatSource } from "@/components/chat/SourceCard";
import {
  type FaqItem,
  type PromptTemplate,
  warmChatSuggestionCaches
} from "@/lib/chatSuggestionsCache";
import { useAppTranslation } from "@/lib/i18n/I18nProvider";

type Props = {
  sessionId: string;
  initialPersistent: boolean;
  initialExpiresAt?: string;
  showSessionControls?: boolean;
};

type SSEEvent =
  | { type: "sources"; data: ChatSource[] }
  | { type: "updated_sources"; data: ChatSource[] }
  | { type: "telemetry"; data: Record<string, unknown> }
  | { type: "token"; data: string }
  | {
      type: "done";
      data: {
        answer: string;
        session_id: string;
        hallScore: number;
        hallReason?: string;
        hallScoreSource?: string;
      };
    };

const PROMPT_POPUP_PREF_KEY = "chat_prompt_popup_enabled_v1";

function parseSSELines(buffer: string): { events: SSEEvent[]; rest: string } {
  const events: SSEEvent[] = [];
  let remaining = buffer;

  let split = remaining.indexOf("\n\n");
  while (split !== -1) {
    const rawEvent = remaining.slice(0, split);
    remaining = remaining.slice(split + 2);

    const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data: "));
    if (dataLine) {
      try {
        const event = JSON.parse(dataLine.slice(6)) as SSEEvent;
        events.push(event);
      } catch {
        // ignore malformed chunks
      }
    }

    split = remaining.indexOf("\n\n");
  }

  return { events, rest: remaining };
}

export default function ChatWindow({
  sessionId,
  initialPersistent,
  initialExpiresAt,
  showSessionControls = true
}: Props) {
  const { t } = useAppTranslation();
  const [messages, setMessages] = useState<ChatMessageVM[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasResponse, setHasResponse] = useState(false);
  const [sessionInitState, setSessionInitState] = useState<"unknown" | "empty" | "history">(
    "unknown"
  );
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [selectedPromptCardId, setSelectedPromptCardId] = useState<string | null>(null);
  const [promptToast, setPromptToast] = useState<string | null>(null);
  const [upgradeFlash, setUpgradeFlash] = useState(false);
  const [inputEmptyFlash, setInputEmptyFlash] = useState(false);
  const [autoPromptPopupEnabled, setAutoPromptPopupEnabled] = useState(true);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const promptToastTimeoutRef = useRef<number | null>(null);

  const canSend = input.trim().length > 0 && !loading;
  const isEmpty = messages.length === 0;
  const isFreshSession = sessionInitState === "empty";

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/chat?sessionId=${encodeURIComponent(sessionId)}`, {
        cache: "no-store"
      });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        items: Array<{
          id: string;
          role: "user" | "assistant" | "system";
          content: string;
          sources?: ChatSource[];
          feedbackRating?: number | null;
          feedbackComment?: string | null;
        }>;
      };

      const filtered = payload.items
        .filter((item) => item.role === "user" || item.role === "assistant")
        .map((item) => ({
          id: item.id,
          role: item.role as "user" | "assistant",
          content: item.content,
          sources: item.sources,
          feedbackRating:
            item.feedbackRating === 1 || item.feedbackRating === -1
              ? (item.feedbackRating as 1 | -1)
              : undefined,
          feedbackComment: item.feedbackComment ?? null
        }));

      setMessages(filtered);
      setSessionInitState((prev) =>
        prev === "unknown" ? (filtered.length === 0 ? "empty" : "history") : prev
      );

      if (filtered.some((m) => m.role === "assistant" && m.content.length > 0)) {
        setHasResponse(true);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    warmChatSuggestionCaches();
  }, []);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(PROMPT_POPUP_PREF_KEY);
      if (raw === "0") {
        setAutoPromptPopupEnabled(false);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(PROMPT_POPUP_PREF_KEY, autoPromptPopupEnabled ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [autoPromptPopupEnabled]);

  useEffect(() => {
    if (!pendingPrompt) return;
    if (loading) return;
    if (input.trim() !== pendingPrompt.trim()) {
      setPendingPrompt(null);
      return;
    }
    void sendMessage();
    setPendingPrompt(null);
  }, [pendingPrompt, input, loading]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
  }, []);

  const updateScrollState = useCallback(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const isNearBottom = distanceFromBottom < 72;
    shouldAutoScrollRef.current = isNearBottom;
    setShowJumpToBottom(!isNearBottom);
  }, []);

  async function sendMessage() {
    const userText = input.trim();
    if (!userText || loading) return;

    setLoading(true);
    setError(null);
    setInput("");

    const userMessage: ChatMessageVM = {
      id: `u-${Date.now()}`,
      role: "user",
      content: userText
    };
    const assistantId = `a-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantId,
        role: "assistant",
        content: ""
      }
    ]);

    try {
      const payloadMessages = [...messages, userMessage].map((message) => ({
        role: message.role,
        content: message.content
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messages: payloadMessages
        })
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Chat stream failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let latestSources: ChatSource[] = [];
      let seenMarker = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSSELines(buffer);
        buffer = rest;

        for (const event of events) {
          // ignore plain sources events, use updated_sources only
          // if (event.type === "sources") {
          //     continue; 
          //   }
          // if (event.type === "sources") {
          //   latestSources = event.data;
          //   setMessages((prev) =>
          //     prev.map((msg) =>
          //       msg.id === assistantId
          //         ? {
          //             ...msg,
          //             sources: latestSources
          //           }
          //         : msg
          //     )
          //   );
          // }

          if (event.type === "updated_sources") {
            latestSources = event.data;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      sources: latestSources
                    }
                  : msg
              )
            );
          }

          if (event.type === "token") {
            if (seenMarker) {
              // ignore tokens after marker
              continue;
            }
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== assistantId) return msg;
                let newContent = msg.content + event.data;
                if (newContent.includes("[[SOURCES]]")) {
                  seenMarker = true;
                  newContent = newContent.split("[[SOURCES]]")[0];
                }
                return {
                  ...msg,
                  content: newContent,
                  sources: latestSources
                };
              })
            );
          }

          if (event.type === "done") {
            const finalAnswer = event.data?.answer ?? "";
            const clean = finalAnswer.split("[[SOURCES]]")[0];
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: clean || msg.content,
                      sources: latestSources
                    }
                  : msg
              )
            );
            setHasResponse(true);
            window.setTimeout(() => {
              void loadHistory();
            }, 350);
          }
        }
      }
    } catch (sendError) {
      setError(t("chat.status.streamError"));
    } finally {
      setLoading(false);
    }
  }

  const showWelcome = isEmpty && sessionInitState !== "history";
  const showGreeting =
    messages.length > 0 && (isFreshSession || sessionInitState === "unknown");

  const resizeComposer = useCallback(() => {
    const element = composerRef.current;
    if (!element) return;
    element.style.height = "0px";
    const nextHeight = Math.min(element.scrollHeight, 180);
    element.style.height = `${Math.max(nextHeight, 24)}px`;
  }, []);

  const showPromptToast = useCallback((message: string) => {
    setPromptToast(message);
    if (promptToastTimeoutRef.current) {
      window.clearTimeout(promptToastTimeoutRef.current);
    }
    promptToastTimeoutRef.current = window.setTimeout(() => {
      setPromptToast(null);
      promptToastTimeoutRef.current = null;
    }, 1800);
  }, []);

  const applyPromptTemplate = useCallback(
    (template: PromptTemplate) => {
      const userPrompt = input.trim();
      if (!userPrompt || loading) {
        showPromptToast(t("chat.promptUpgrade.emptyInput"));
        setInputEmptyFlash(true);
        window.setTimeout(() => setInputEmptyFlash(false), 1000);
        return;
      }

      const placeholderPattern = /\$\{\s*(?:промпт|prompt)\s*\}/iu;
      const placeholderRegexGlobal = /\$\{\s*(?:промпт|prompt)\s*\}/giu;
      const hasPlaceholder = placeholderPattern.test(template.content);
      const improvedPrompt = hasPlaceholder
        ? template.content.replace(placeholderRegexGlobal, userPrompt)
        : `${template.content.trim()}\n\n${userPrompt}`;

      setSelectedPromptCardId(template.id);
      setUpgradeFlash(true);
      window.setTimeout(() => setUpgradeFlash(false), 1400);
      window.setTimeout(() => setSelectedPromptCardId(null), 1400);
      setInput(improvedPrompt);
      setPendingPrompt(improvedPrompt);
    },
    [input, loading, showPromptToast]
  );

  const applyFaqQuestion = useCallback(
    (item: FaqItem) => {
      if (loading) return;
      setInput(item.question);
      setPendingPrompt(item.question);
    },
    [loading]
  );

  useEffect(
    () => () => {
      if (promptToastTimeoutRef.current) {
        window.clearTimeout(promptToastTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    resizeComposer();
  }, [input, resizeComposer]);

  useEffect(() => {
    if (showWelcome) return;
    if (!shouldAutoScrollRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      scrollToBottom();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [messages, showWelcome, scrollToBottom]);

  return (
    <div className="relative left-1/2 right-1/2 -my-6 h-[calc(100dvh-64px)] w-[100dvw] -ml-[50dvw] -mr-[50dvw] overflow-hidden bg-page">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-[-120px] left-[-80px] h-72 w-72 rounded-full bg-orange-50/80 blur-3xl" />
      </div>
      <div className="relative flex h-full w-full flex-col px-4 py-4 sm:px-6">
        <header className="flex items-center justify-between pb-4 pt-2 sm:pb-6">
          {showSessionControls ? (
            <div className="w-fit">
              <SessionToggle
                sessionId={sessionId}
                initialPersistent={initialPersistent}
                initialExpiresAt={initialExpiresAt}
                canCreateNewSession={hasResponse}
              />
            </div>
          ) : null}
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden pb-4 pt-2 sm:pb-6">
          <div className="relative flex h-full w-full min-h-0 flex-1 flex-col">
            {showWelcome ? (
              <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center justify-center gap-8 pb-6 text-center">
                <div>
                  <h1 className="text-4xl font-semibold tracking-[-0.03em] text-[#087dbb] sm:text-5xl">
                    {t("chat.welcome.title")}
                  </h1>
                  <p className="mt-2 text-2xl font-semibold text-[#087dbb] sm:text-3xl">
                    {t("chat.welcome.subtitle")}
                  </p>
                </div>
                <div className="w-full max-w-[920px] text-left">
                  <p className="mb-3 text-sm font-semibold text-slate-500">{t("chat.welcome.faqLabel")}</p>
                  <FaqCards layout="grid" onPick={applyFaqQuestion} />
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="w-full rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {!showWelcome ? (
              <div
                ref={messagesViewportRef}
                onScroll={updateScrollState}
                className="w-full min-h-0 flex-1 overflow-y-auto"
              >
                <div className="mx-auto flex min-h-full w-full max-w-[1200px] flex-col gap-6 pb-4 pr-2 sm:gap-10">
                  {messages.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      {historyLoading ? t("common.states.loading") : t("chat.status.noMessages")}
                    </p>
                  ) : null}
                  {showGreeting ? (
                    <div className="flex items-start gap-4 sm:gap-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#087dbb] shadow-[0_8px_20px_rgba(15,23,42,0.12)]">
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
                      <div className="w-full rounded-3xl border border-border bg-card px-5 py-3 text-[15px] leading-relaxed text-slate-800 shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:px-6 sm:py-4">
                        {t("chat.greeting.intro")}
                        <br />
                        {t("chat.greeting.question")}
                      </div>
                    </div>
                  ) : null}
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      sessionId={sessionId}
                      onFeedbackSaved={(messageId, payload) => {
                        setMessages((prev) =>
                          prev.map((item) =>
                            item.id === messageId
                              ? {
                                  ...item,
                                  feedbackRating: payload.rating,
                                  feedbackComment: payload.comment
                                }
                              : item
                          )
                        );
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="relative mx-auto w-full max-w-[920px] shrink-0 pt-2 sm:pt-3">
              <div
                className={`absolute inset-x-0 bottom-[calc(100%+0.55rem)] z-10 transition-all duration-200 ${
                  autoPromptPopupEnabled && input.trim().length > 0
                    ? "pointer-events-auto translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-2 opacity-0"
                }`}
              >
                <div className="rounded-2xl border border-[#b8dfff]/80 bg-gradient-to-r from-white/90 via-white/85 to-orange-50/80 px-3 py-3 shadow-[0_18px_34px_-22px_rgba(15,23,42,0.38)] backdrop-blur-[2px] sm:px-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                      {t("chat.promptUpgrade.title")}
                    </p>
                    <span className="rounded-full border border-orange-200/90 bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                      {t("chat.promptUpgrade.badge")}
                    </span>
                  </div>
                  <PromptCards
                    layout="row"
                    activeId={selectedPromptCardId}
                    onPick={applyPromptTemplate}
                  />
                </div>
              </div>

              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  await sendMessage();
                }}
                className={`flex items-center gap-3 overflow-hidden rounded-full border bg-white/72 px-5 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-[2px] transition sm:px-8 sm:py-4 ${
                  inputEmptyFlash
                    ? "animate-pulse border-red-300 shadow-[0_0_0_3px_rgba(248,113,113,0.18)]"
                    : upgradeFlash
                      ? "border-[#7bc4f4] shadow-[0_0_0_3px_rgba(8,125,187,0.18)]"
                      : "border-white/60 focus-within:border-[#7bc4f4] focus-within:shadow-[0_0_0_3px_rgba(123,196,244,0.25)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setAutoPromptPopupEnabled((prev) => !prev)}
                  className={`-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition sm:-ml-0.5 ${
                    autoPromptPopupEnabled
                      ? "border-[#7bc4f4] bg-orange-50 text-[#087dbb]"
                      : "border-border bg-white/80 text-slate-500 hover:text-slate-700"
                  }`}
                  title={
                    autoPromptPopupEnabled
                      ? t("chat.promptUpgrade.disable")
                      : t("chat.promptUpgrade.enable")
                  }
                  aria-label={
                    autoPromptPopupEnabled
                      ? t("chat.promptUpgrade.disable")
                      : t("chat.promptUpgrade.enable")
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path d="m12 2 1.8 4.3L18 8.1l-4.2 1.8L12 14l-1.8-4.1L6 8.1l4.2-1.8L12 2Z" />
                    <path d="M18.5 15.5 19.4 18l2.6.9-2.6.9-.9 2.5-.9-2.5-2.6-.9 2.6-.9.9-2.5Z" />
                  </svg>
                </button>
                <textarea
                  ref={composerRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={async (event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      await sendMessage();
                    }
                  }}
                  placeholder={t("chat.composer.placeholder")}
                  disabled={loading}
                  rows={1}
                  className="max-h-[180px] min-h-[24px] flex-1 resize-none overflow-y-auto bg-transparent py-1 text-[15px] leading-6 text-slate-800 outline-none placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  className={`flex h-11 w-11 items-center justify-center rounded-full transition-all sm:h-12 sm:w-12 ${
                    canSend
                      ? "bg-[#087dbb] text-white shadow-[0_12px_26px_rgba(8,125,187,0.32)]"
                      : "bg-[#b8dfff] text-white/70 cursor-not-allowed"
                  }`}
                  aria-label={loading ? t("chat.composer.sending") : t("chat.composer.send")}
                >
                  {loading ? (
                    <TypingDots className="text-white" size="sm" />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path d="M10.7 13.3 19 5" />
                      <path d="M19 5 14 19l-3.3-5.7L5 10l14-5Z" />
                    </svg>
                  )}
                </button>
              </form>
            </div>

            {promptToast ? (
              <div className="pointer-events-none absolute bottom-20 left-1/2 z-30 -translate-x-1/2 px-4 sm:bottom-24">
                <div className="rounded-full border border-red-200/80 bg-white/95 px-4 py-2 text-sm font-medium text-red-600 shadow-[0_14px_28px_rgba(15,23,42,0.2)] backdrop-blur">
                  {promptToast}
                </div>
              </div>
            ) : null}

            {!showWelcome && showJumpToBottom ? (
              <button
                type="button"
                onClick={() => {
                  shouldAutoScrollRef.current = true;
                  setShowJumpToBottom(false);
                  scrollToBottom("smooth");
                }}
                className="absolute bottom-24 right-8 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-slate-600 shadow-[0_12px_24px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:text-slate-800 sm:bottom-28 sm:right-10"
                aria-label={t("chat.jumpToLatest.ariaLabel")}
                title={t("chat.jumpToLatest.title")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M12 5v14" />
                  <path d="m6 13 6 6 6-6" />
                </svg>
              </button>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

import { NextResponse } from "next/server";

import { calculateUsageCosts, type PersistableUsageEvent } from "@/lib/aiUsage";
import { prisma } from "@/lib/db";
import { resolveRequestSession } from "@/lib/request-session";

export const runtime = "nodejs";

type InputMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type DoneEventPayload = {
  answer?: string;
  session_id?: string;
  hallScore?: number;
  hallReason?: string;
  hallScoreSource?: string;
};

type SourcePayload = {
  fileId?: string;
  filename?: string;
  similarity?: number;
  snippet?: string;
};

type TelemetryPayload = {
  operation?: unknown;
  model?: unknown;
  provider?: unknown;
  usage_source?: unknown;
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  total_tokens?: unknown;
  latency_ms?: unknown;
  status?: unknown;
  error_code?: unknown;
};

type SessionContext = {
  sessionId: string;
  email: string;
  role: "ADMIN" | "USER";
  persistent: boolean;
  expiresAt: Date;
};

function backendUrl(path: string): string {
  const base = process.env.PYTHON_BACKEND_URL ?? "http://backend:8000";
  return `${base}${path}`;
}

async function ensureUserAndSession(params: {
  email: string;
  role: "ADMIN" | "USER";
  sessionId: string;
  persistent: boolean;
  expiresAt: Date;
}) {
  const user = await prisma.user.upsert({
    where: { email: params.email },
    update: { role: params.role },
    create: {
      email: params.email,
      passwordHash: "__managed_by_nextauth__",
      role: params.role
    }
  });

  await prisma.session.upsert({
    where: { id: params.sessionId },
    update: {
      userId: user.id,
      expiresAt: params.expiresAt,
      persistent: params.persistent
    },
    create: {
      id: params.sessionId,
      userId: user.id,
      expiresAt: params.expiresAt,
      persistent: params.persistent
    }
  });

  return user;
}

function normalizeTelemetryEvent(payload: TelemetryPayload): PersistableUsageEvent | null {
  const operation = typeof payload.operation === "string" ? payload.operation : null;
  const model = typeof payload.model === "string" ? payload.model : null;
  if (!operation || !model) {
    return null;
  }

  const promptTokens =
    typeof payload.prompt_tokens === "number" && Number.isFinite(payload.prompt_tokens)
      ? Math.max(0, Math.round(payload.prompt_tokens))
      : 0;
  const completionTokens =
    typeof payload.completion_tokens === "number" && Number.isFinite(payload.completion_tokens)
      ? Math.max(0, Math.round(payload.completion_tokens))
      : 0;
  const totalTokens =
    typeof payload.total_tokens === "number" && Number.isFinite(payload.total_tokens)
      ? Math.max(0, Math.round(payload.total_tokens))
      : promptTokens + completionTokens;

  return {
    operation,
    model,
    provider: typeof payload.provider === "string" ? payload.provider : "openai",
    usageSource: typeof payload.usage_source === "string" ? payload.usage_source : "exact",
    promptTokens,
    completionTokens,
    totalTokens,
    latencyMs:
      typeof payload.latency_ms === "number" && Number.isFinite(payload.latency_ms)
        ? Math.max(0, Math.round(payload.latency_ms))
        : null,
    status: typeof payload.status === "string" ? payload.status : "ok",
    errorCode: typeof payload.error_code === "string" ? payload.error_code : null
  };
}

async function persistUsageEvents(params: {
  messageId: string;
  sessionId: string;
  events: PersistableUsageEvent[];
}) {
  if (params.events.length === 0) {
    return;
  }

  await prisma.aiUsageEvent.createMany({
    data: params.events.map((event) => {
      const costs = calculateUsageCosts(event.model, event.promptTokens, event.completionTokens);

      return {
        sessionId: params.sessionId,
        messageId: params.messageId,
        operation: event.operation,
        model: event.model,
        provider: event.provider ?? "openai",
        usageSource: event.usageSource ?? "exact",
        promptTokens: event.promptTokens,
        completionTokens: event.completionTokens,
        totalTokens: event.totalTokens,
        latencyMs: event.latencyMs ?? null,
        costInputUsd: costs.costInputUsd,
        costOutputUsd: costs.costOutputUsd,
        costTotalUsd: costs.costTotalUsd,
        status: event.status ?? "ok",
        errorCode: event.errorCode ?? null
      };
    })
  });
}

async function backfillHallScore(params: {
  messageId: string;
  sessionId: string;
  answer: string;
  sources: SourcePayload[];
  fallbackHallScore: number | null;
  fallbackHallReason: string | null;
  fallbackHallScoreSource: string | null;
}) {
  try {
    const response = await fetch(backendUrl("/api/v1/evaluate"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        answer: params.answer,
        contextBlocks: params.sources
          .map((item) => (typeof item.snippet === "string" ? item.snippet : ""))
          .filter((item) => item.length > 0)
          .slice(0, 12)
      })
    });
    if (!response.ok) return;

    const payload = (await response.json()) as {
      hallScore?: unknown;
      reason?: unknown;
      model?: unknown;
      source?: unknown;
      latencyMs?: unknown;
      usage?: TelemetryPayload | null;
    };
    const score =
      typeof payload.hallScore === "number" && Number.isFinite(payload.hallScore)
        ? payload.hallScore
        : null;
    const reason = typeof payload.reason === "string" ? payload.reason : params.fallbackHallReason;
    const judgeModel = typeof payload.model === "string" ? payload.model : null;
    const scoreSource =
      typeof payload.source === "string"
        ? payload.source
        : params.fallbackHallScoreSource ?? "heuristic";

    await prisma.message.update({
      where: { id: params.messageId },
      data: {
        hallScore: score ?? params.fallbackHallScore,
        hallReason: reason,
        hallJudgeModel: judgeModel,
        hallScoreSource: scoreSource,
        hallEvaluatedAt: new Date()
      }
    });

    const usageEvent = payload.usage ? normalizeTelemetryEvent(payload.usage) : null;
    if (usageEvent) {
      usageEvent.latencyMs =
        typeof payload.latencyMs === "number" && Number.isFinite(payload.latencyMs)
          ? payload.latencyMs
          : usageEvent.latencyMs;
      await persistUsageEvents({
        messageId: params.messageId,
        sessionId: params.sessionId,
        events: [usageEvent]
      });
    }
  } catch {
    await prisma.message.update({
      where: { id: params.messageId },
      data: {
        hallScore: params.fallbackHallScore,
        hallReason: params.fallbackHallReason,
        hallScoreSource: params.fallbackHallScoreSource ?? "heuristic",
        hallEvaluatedAt: new Date()
      }
    }).catch(() => undefined);
    return;
  }
}

async function persistDoneFromSSE(
  stream: ReadableStream<Uint8Array>,
  ctx: SessionContext & { userMessage: string }
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sources: SourcePayload[] = [];
  let telemetryEvents: PersistableUsageEvent[] = [];

  try {
    await ensureUserAndSession({
      email: ctx.email,
      role: ctx.role,
      sessionId: ctx.sessionId,
      persistent: ctx.persistent,
      expiresAt: ctx.expiresAt
    });

    await prisma.message.create({
      data: {
        sessionId: ctx.sessionId,
        role: "user",
        content: ctx.userMessage
      }
    });

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        const dataLine = chunk
          .split("\n")
          .find((line) => line.startsWith("data: "));

        if (dataLine) {
          const raw = dataLine.slice(6);
          let event: { type?: string; data?: unknown } | null = null;
          try {
            event = JSON.parse(raw) as { type?: string; data?: unknown };
          } catch {
            boundary = buffer.indexOf("\n\n");
            continue;
          }

          if ((event.type === "sources" || event.type === "updated_sources") && Array.isArray(event.data)) {
            // track latest source list, give precedence to parsed sources
            sources = event.data as SourcePayload[];
          }

          if (event.type === "telemetry" && event.data && typeof event.data === "object") {
            const normalized = normalizeTelemetryEvent(event.data as TelemetryPayload);
            if (normalized) {
              telemetryEvents = [...telemetryEvents, normalized];
            }
          }

          if (event.type === "done") {
            const data = (event.data ?? {}) as DoneEventPayload;
            const answer = typeof data.answer === "string" ? data.answer : "";
            const hallScore =
              typeof data.hallScore === "number" && Number.isFinite(data.hallScore)
                ? data.hallScore
                : null;
            const hallReason = typeof data.hallReason === "string" ? data.hallReason : null;
            const hallScoreSource =
              typeof data.hallScoreSource === "string" ? data.hallScoreSource : "heuristic";

            const saved = await prisma.message.create({
              data: {
                sessionId: ctx.sessionId,
                role: "assistant",
                content: answer,
                sources,
                hallScore,
                hallReason,
                hallScoreSource
              }
            });
            if (telemetryEvents.length > 0) {
              void persistUsageEvents({
                messageId: saved.id,
                sessionId: ctx.sessionId,
                events: telemetryEvents
              });
            }
            if (answer.trim().length > 0) {
              void backfillHallScore({
                messageId: saved.id,
                sessionId: ctx.sessionId,
                answer,
                sources,
                fallbackHallScore: hallScore,
                fallbackHallReason: hallReason,
                fallbackHallScoreSource: hallScoreSource
              });
            }

            return;
          }
        }

        boundary = buffer.indexOf("\n\n");
      }
    }
  } catch {
    return;
  } finally {
    reader.releaseLock();
  }
}

async function resolveSessionContext(request: Request, bodySessionId?: unknown): Promise<SessionContext | null> {
  const resolved = await resolveRequestSession(request, bodySessionId);
  if (!resolved) {
    return null;
  }

  return {
    sessionId: resolved.sessionId,
    email: resolved.email,
    role: resolved.role,
    persistent: resolved.persistent,
    expiresAt: resolved.expiresAt
  };
}

export async function GET(request: Request) {
  const ctx = await resolveSessionContext(request);

  if (!ctx) {
    return NextResponse.json({ items: [] });
  }

  const rows: Array<{
    id: string;
    role: string;
    content: string;
    sources: unknown;
    createdAt: Date;
    feedback: { rating: number; comment: string | null } | null;
  }> = await prisma.message.findMany({
    where: { sessionId: ctx.sessionId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      sources: true,
      createdAt: true,
      feedback: {
        select: {
          rating: true,
          comment: true
        }
      }
    }
  });

  return NextResponse.json({
    items: rows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      sources: row.sources,
      createdAt: row.createdAt.toISOString(),
      feedbackRating: row.feedback?.rating,
      feedbackComment: row.feedback?.comment ?? null
    }))
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    sessionId?: string;
    messages?: InputMessage[];
  };
  const ctx = await resolveSessionContext(request, payload.sessionId);
  if (!ctx) {
    return NextResponse.json({ error: "Session is not active" }, { status: 401 });
  }

  const messages = payload.messages ?? [];
  const lastUserMessage = [...messages].reverse().find((msg) => msg.role === "user")?.content ?? "";

  let upstream: Response;
  try {
    upstream = await fetch(backendUrl("/api/v1/chat"), {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        session_id: ctx.sessionId,
        messages
      })
    });
  } catch (error) {
    const maybeCode =
      error && typeof error === "object" && "cause" in error
        ? (error as { cause?: { code?: string } }).cause?.code
        : undefined;

    const isBackendUnavailable = maybeCode === "ECONNREFUSED" || maybeCode === "ENOTFOUND";

    return NextResponse.json(
      {
        error: isBackendUnavailable ? "Chat backend is unavailable" : "Failed to connect to chat backend"
      },
      { status: 503 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    return new Response(text || "Chat backend error", { status: upstream.status || 500 });
  }

  const [clientStream, auditStream] = upstream.body.tee();

  void persistDoneFromSSE(auditStream, {
    sessionId: ctx.sessionId,
    userMessage: lastUserMessage,
    email: ctx.email,
    role: ctx.role,
    persistent: ctx.persistent,
    expiresAt: ctx.expiresAt
  });

  return new Response(clientStream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    }
  });
}

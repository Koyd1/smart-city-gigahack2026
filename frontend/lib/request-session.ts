import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readPublicSessionIdFromRequest } from "@/lib/public-session";
import { extendSessionIfNeeded } from "@/lib/session";

type SessionRow = {
  id: string;
  userId: string;
  expiresAt: Date;
  terminatedAt: Date | null;
  user: {
    email: string;
    role: "ADMIN" | "USER";
  };
};

export type ResolvedRequestSession = {
  sessionId: string;
  userId: string;
  email: string;
  role: "ADMIN" | "USER";
  persistent: boolean;
  expiresAt: Date;
};

function normalizeSessionId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getRequestedSessionId(request: Request, payloadSessionId?: unknown): string | null {
  const sidFromPayload = normalizeSessionId(payloadSessionId);
  const url = new URL(request.url);
  const sidFromQuery = normalizeSessionId(
    url.searchParams.get("sessionId") ?? url.searchParams.get("sid")
  );
  return sidFromPayload ?? sidFromQuery;
}

async function loadSessionRow(sessionId: string): Promise<SessionRow | null> {
  return prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      terminatedAt: true,
      user: {
        select: {
          email: true,
          role: true
        }
      }
    }
  });
}

function isSessionRowActive(row: SessionRow): boolean {
  if (row.terminatedAt) {
    return false;
  }
  return row.expiresAt.getTime() > Date.now();
}

async function finalizeActiveSession(row: SessionRow): Promise<ResolvedRequestSession | null> {
  if (!isSessionRowActive(row)) {
    return null;
  }

  const extended = await extendSessionIfNeeded(row.id);
  if (!extended || extended.terminatedAt || extended.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return {
    sessionId: row.id,
    userId: row.userId,
    email: row.user.email,
    role: row.user.role === "ADMIN" ? "ADMIN" : "USER",
    persistent: extended.persistent,
    expiresAt: extended.expiresAt
  };
}

async function resolveSignedInSession(params: {
  requestedSessionId: string | null;
}): Promise<ResolvedRequestSession | null> {
  const session = await auth();
  const signedInSessionId = normalizeSessionId(session?.sessionId);
  if (!signedInSessionId) {
    return null;
  }

  const signedInRow = await loadSessionRow(signedInSessionId);

  if (!params.requestedSessionId || params.requestedSessionId === signedInSessionId) {
    return signedInRow ? finalizeActiveSession(signedInRow) : null;
  }

  const candidateRow = await loadSessionRow(params.requestedSessionId);
  if (!candidateRow || !isSessionRowActive(candidateRow)) {
    return null;
  }

  const signedInEmail = session?.user.email?.trim().toLowerCase() ?? "";
  const candidateEmail = candidateRow.user.email.trim().toLowerCase();
  let sameOwner = Boolean(signedInEmail && signedInEmail === candidateEmail);
  if (!sameOwner && signedInRow) {
    sameOwner = signedInRow.userId === candidateRow.userId;
  }

  if (!sameOwner) {
    return null;
  }

  return finalizeActiveSession(candidateRow);
}

export async function resolveRequestSession(
  request: Request,
  payloadSessionId?: unknown
): Promise<ResolvedRequestSession | null> {
  const requestedSessionId = getRequestedSessionId(request, payloadSessionId);

  const signedInSession = await resolveSignedInSession({
    requestedSessionId
  });
  if (signedInSession) {
    return signedInSession;
  }

  const publicSessionId = readPublicSessionIdFromRequest(request);
  if (!publicSessionId) {
    return null;
  }
  if (requestedSessionId && requestedSessionId !== publicSessionId) {
    return null;
  }

  const publicRow = await loadSessionRow(publicSessionId);
  if (!publicRow) {
    return null;
  }

  return finalizeActiveSession(publicRow);
}

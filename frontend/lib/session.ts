import { prisma } from "@/lib/db";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const EXTEND_BY_MS = 2 * 60 * 60 * 1000;
const DB_RETRY_ATTEMPTS = 3;
const DB_RETRY_DELAY_MS = 250;

export type AppSession = {
  id: string;
  userId: string;
  persistent: boolean;
  expiresAt: Date;
  terminatedAt?: Date;
};

function isRetryableDbError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("can't reach database server") ||
    message.includes("prismaclientinitializationerror") ||
    message.includes("timed out") ||
    message.includes("connection")
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withDbRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableDbError(error) || attempt === DB_RETRY_ATTEMPTS) {
        throw error;
      }
      await delay(DB_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Database query failed");
}

export async function ensurePublicUserId(): Promise<string> {
  const guest = await prisma.user.upsert({
    where: { email: "guest@public.local" },
    update: { role: "USER" },
    create: {
      email: "guest@public.local",
      passwordHash: "__public_access__",
      role: "USER"
    },
    select: { id: true }
  });

  return guest.id;
}

function toAppSession(row: {
  id: string;
  userId: string;
  persistent: boolean;
  expiresAt: Date;
  terminatedAt: Date | null;
}): AppSession {
  return {
    id: row.id,
    userId: row.userId,
    persistent: row.persistent,
    expiresAt: row.expiresAt,
    terminatedAt: row.terminatedAt ?? undefined
  };
}

export async function createAppSession(userId: string, persistent = true): Promise<AppSession> {
  const created = await prisma.session.create({
    data: {
      userId,
      persistent,
      expiresAt: new Date(Date.now() + SIX_HOURS_MS)
    },
    select: {
      id: true,
      userId: true,
      persistent: true,
      expiresAt: true,
      terminatedAt: true
    }
  });

  return toAppSession(created);
}

export async function terminateSession(sessionId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, terminatedAt: null },
    data: { terminatedAt: new Date() }
  });
}

export async function sessionHasMessages(sessionId: string): Promise<boolean> {
  const count = await prisma.message.count({
    where: { sessionId }
  });
  return count > 0;
}

export async function findEmptyActiveSession(userId: string): Promise<AppSession | null> {
  const found = await prisma.session.findFirst({
    where: {
      userId,
      terminatedAt: null,
      expiresAt: { gt: new Date() },
      messages: { none: {} }
    },
    select: {
      id: true,
      userId: true,
      persistent: true,
      expiresAt: true,
      terminatedAt: true
    },
    orderBy: { createdAt: "desc" }
  });

  return found ? toAppSession(found) : null;
}

export async function isSessionActive(sessionId: string): Promise<boolean> {
  const found = await withDbRetry(() =>
    prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        expiresAt: true,
        terminatedAt: true
      }
    })
  );

  if (!found) return false;
  if (found.terminatedAt) return false;
  if (found.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

export async function getSessionById(sessionId: string): Promise<AppSession | null> {
  const found = await withDbRetry(() =>
    prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        persistent: true,
        expiresAt: true,
        terminatedAt: true
      }
    })
  );

  return found ? toAppSession(found) : null;
}

export async function setSessionPersistent(
  sessionId: string,
  persistent: boolean
): Promise<AppSession | null> {
  const updated = await prisma.session.updateMany({
    where: { id: sessionId },
    data: { persistent }
  });

  if (updated.count === 0) {
    return null;
  }

  return getSessionById(sessionId);
}

export async function getSessionRemainingMs(sessionId: string): Promise<number> {
  const found = await getSessionById(sessionId);
  if (!found) return 0;
  return found.expiresAt.getTime() - Date.now();
}

export async function extendSessionIfNeeded(sessionId: string): Promise<AppSession | null> {
  const found = await getSessionById(sessionId);
  if (!found) return null;
  if (found.terminatedAt) return found;
  if (!found.persistent) return found;

  const remaining = found.expiresAt.getTime() - Date.now();
  if (remaining < ONE_HOUR_MS) {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        expiresAt: new Date(found.expiresAt.getTime() + EXTEND_BY_MS)
      }
    });

    return getSessionById(sessionId);
  }

  return found;
}

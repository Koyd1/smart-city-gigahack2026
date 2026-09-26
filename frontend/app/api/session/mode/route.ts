import { NextResponse } from "next/server";

import { resolveRequestSession } from "@/lib/request-session";
import {
  getSessionById,
  getSessionRemainingMs,
  setSessionPersistent
} from "@/lib/session";

export async function GET(request: Request) {
  const resolved = await resolveRequestSession(request);

  if (!resolved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appSession = await getSessionById(resolved.sessionId);
  if (!appSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    persistent: appSession.persistent,
    expiresAt: appSession.expiresAt.toISOString(),
    remainingMs: await getSessionRemainingMs(appSession.id)
  });
}

export async function PATCH(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | { persistent?: boolean; sessionId?: string }
    | null;
  if (!payload || typeof payload.persistent !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const resolved = await resolveRequestSession(request, payload.sessionId);
  if (!resolved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const updated = await setSessionPersistent(resolved.sessionId, payload.persistent);
  if (!updated) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    persistent: updated.persistent,
    expiresAt: updated.expiresAt.toISOString(),
    remainingMs: await getSessionRemainingMs(updated.id)
  });
}

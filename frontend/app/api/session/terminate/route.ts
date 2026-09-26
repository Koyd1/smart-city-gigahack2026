import { NextResponse } from "next/server";

import { resolveRequestSession } from "@/lib/request-session";
import { sessionHasMessages, terminateSession } from "@/lib/session";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { sessionId?: string } | null;
  const resolved = await resolveRequestSession(request, payload?.sessionId);

  if (!resolved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasMessages = await sessionHasMessages(resolved.sessionId);
  if (!hasMessages) {
    return NextResponse.json(
      { error: "Отправьте хотя бы одно сообщение перед завершением сессии" },
      { status: 400 }
    );
  }

  await terminateSession(resolved.sessionId);
  return NextResponse.json({ ok: true });
}

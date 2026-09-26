import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/lib/auth";
import {
  createAppSession,
  ensurePublicUserId,
  findEmptyActiveSession,
  isSessionActive
} from "@/lib/session";
import {
  encodePublicSessionCookieValue,
  PUBLIC_SESSION_COOKIE_NAME,
  verifyPublicSessionCookieValue
} from "@/lib/public-session";

function setPublicSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set({
    name: PUBLIC_SESSION_COOKIE_NAME,
    value: encodePublicSessionCookieValue(sessionId),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function GET(request: Request) {
  const signedIn = await auth();
  if (signedIn?.sessionId && (await isSessionActive(signedIn.sessionId))) {
    return NextResponse.redirect(new URL(`/chat?sid=${signedIn.sessionId}`, request.url));
  }

  const cookieStore = await cookies();
  const currentRaw = cookieStore.get(PUBLIC_SESSION_COOKIE_NAME)?.value;
  const currentSessionId = verifyPublicSessionCookieValue(currentRaw);

  let sessionId: string | null = null;
  if (currentSessionId && (await isSessionActive(currentSessionId))) {
    sessionId = currentSessionId;
  } else {
    const userId = await ensurePublicUserId();
    const existing = await findEmptyActiveSession(userId);
    sessionId = existing?.id ?? (await createAppSession(userId, true)).id;
  }

  const response = NextResponse.redirect(new URL(`/chat?sid=${sessionId}`, request.url));
  setPublicSessionCookie(response, sessionId);
  return response;
}

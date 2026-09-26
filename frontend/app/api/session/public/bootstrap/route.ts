import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/lib/auth";
import {
  createPublicSession,
  isSessionActive
} from "@/lib/session";
import {
  encodePublicSessionCookieValue,
  PUBLIC_SESSION_COOKIE_NAME,
  verifyPublicSessionCookieValue
} from "@/lib/public-session";
import { publicUrl, shouldUseSecureCookies } from "@/lib/request-origin";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";

function setPublicSessionCookie(response: NextResponse, request: Request, sessionId: string): void {
  response.cookies.set({
    name: PUBLIC_SESSION_COOKIE_NAME,
    value: encodePublicSessionCookieValue(sessionId),
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(request),
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function GET(request: Request) {
  const limit = await consumeRateLimit({
    key: `bootstrap:${requestIp(request)}`,
    capacity: 20,
    refillPerSecond: 20 / 60
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many session requests" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } }
    );
  }

  const signedIn = await auth();
  if (signedIn?.sessionId && (await isSessionActive(signedIn.sessionId))) {
    return NextResponse.redirect(publicUrl(request, `/chat?sid=${signedIn.sessionId}`));
  }

  const cookieStore = await cookies();
  const currentRaw = cookieStore.get(PUBLIC_SESSION_COOKIE_NAME)?.value;
  const currentSessionId = verifyPublicSessionCookieValue(currentRaw);

  let sessionId: string | null = null;
  if (currentSessionId && (await isSessionActive(currentSessionId))) {
    sessionId = currentSessionId;
  } else {
    sessionId = (await createPublicSession()).id;
  }

  const response = NextResponse.redirect(publicUrl(request, `/chat?sid=${sessionId}`));
  setPublicSessionCookie(response, request, sessionId);
  return response;
}

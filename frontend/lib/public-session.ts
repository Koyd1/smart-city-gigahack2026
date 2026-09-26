import { createHmac, timingSafeEqual } from "crypto";

const DEV_FALLBACK_SECRET = "dev-public-session-secret-change-me";
export const PUBLIC_SESSION_COOKIE_NAME = "public_session";

function getSigningSecret(): string {
  const configured =
    process.env.PUBLIC_SESSION_SECRET?.trim() ??
    process.env.NEXTAUTH_SECRET?.trim() ??
    "";

  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("PUBLIC_SESSION_SECRET or NEXTAUTH_SECRET is required in production");
  }

  return configured || DEV_FALLBACK_SECRET;
}

function signSessionId(sessionId: string): string {
  return createHmac("sha256", getSigningSecret())
    .update(sessionId)
    .digest("base64url");
}

export function encodePublicSessionCookieValue(sessionId: string): string {
  return `${sessionId}.${signSessionId(sessionId)}`;
}

export function verifyPublicSessionCookieValue(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const splitIndex = raw.lastIndexOf(".");
  if (splitIndex <= 0) {
    return null;
  }

  const sessionId = raw.slice(0, splitIndex);
  const signature = raw.slice(splitIndex + 1);
  if (!sessionId || !signature) {
    return null;
  }

  const expected = signSessionId(sessionId);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return null;
  }

  return timingSafeEqual(left, right) ? sessionId : null;
}

export function readCookieFromRequest(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey !== name) {
      continue;
    }
    return decodeURIComponent(rawValue.join("="));
  }

  return null;
}

export function readPublicSessionIdFromRequest(request: Request): string | null {
  const raw = readCookieFromRequest(request, PUBLIC_SESSION_COOKIE_NAME);
  return verifyPublicSessionCookieValue(raw);
}

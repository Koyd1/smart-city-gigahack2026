const DEFAULT_LOCAL_ORIGIN = "http://127.0.0.1:3000";

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getPublicOrigin(request: Request): string {
  const configured =
    normalizeOrigin(process.env.WEB_ORIGIN) ?? normalizeOrigin(process.env.NEXTAUTH_URL);
  if (configured) return configured;

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if ((forwardedProto === "http" || forwardedProto === "https") && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return normalizeOrigin(request.url) ?? DEFAULT_LOCAL_ORIGIN;
}

export function publicUrl(request: Request, path: string): URL {
  return new URL(path, getPublicOrigin(request));
}

export function shouldUseSecureCookies(request: Request): boolean {
  return getPublicOrigin(request).startsWith("https://");
}

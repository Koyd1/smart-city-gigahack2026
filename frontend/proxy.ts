import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

function asSessionId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const sessionId = asSessionId(req.auth?.sessionId);
  const role = req.auth?.user.role === "ADMIN" ? "ADMIN" : "USER";

  if (!req.auth || !sessionId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (role !== "ADMIN") {
    return NextResponse.redirect(new URL("/chat", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"]
};

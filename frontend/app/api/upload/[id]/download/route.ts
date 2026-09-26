import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

function backendUrl(path: string): string {
  const base = process.env.PYTHON_BACKEND_URL ?? "http://backend:8000";
  return `${base}${path}`;
}

async function ensureAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await ensureAdmin();
  if (forbidden) return forbidden;

  const { id } = await params;
  const response = await fetch(backendUrl(`/api/v1/ingest/${id}/download`), {
    cache: "no-store"
  });

  if (!response.body) {
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
    });
  }

  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  const contentDisposition = response.headers.get("content-disposition");
  const contentLength = response.headers.get("content-length");

  if (contentType) headers.set("content-type", contentType);
  if (contentDisposition) headers.set("content-disposition", contentDisposition);
  if (contentLength) headers.set("content-length", contentLength);

  return new Response(response.body, {
    status: response.status,
    headers
  });
}

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
  const response = await fetch(backendUrl(`/api/v1/ingest/${id}/status`), {
    cache: "no-store"
  });

  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: { "content-type": "application/json" }
  });
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await ensureAdmin();
  if (forbidden) return forbidden;

  const { id } = await params;
  const response = await fetch(backendUrl(`/api/v1/ingest/${id}/reindex`), {
    method: "POST"
  });

  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: { "content-type": "application/json" }
  });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await ensureAdmin();
  if (forbidden) return forbidden;

  const { id } = await params;
  const response = await fetch(backendUrl(`/api/v1/ingest/${id}`), {
    method: "DELETE"
  });

  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: { "content-type": "application/json" }
  });
}

import { NextResponse } from "next/server";

export async function GET() {
  const backendUrl = process.env.PYTHON_BACKEND_URL ?? "http://backend:8000";

  try {
    const response = await fetch(`${backendUrl}/api/v1/health/detailed`, { cache: "no-store" });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}

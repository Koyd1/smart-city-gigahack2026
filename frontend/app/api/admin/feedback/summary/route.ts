import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [total, positive, negative] = await Promise.all([
    prisma.feedback.count(),
    prisma.feedback.count({ where: { rating: 1 } }),
    prisma.feedback.count({ where: { rating: -1 } })
  ]);

  const positiveRate = total > 0 ? Math.round((positive / total) * 10000) / 100 : 0;

  return NextResponse.json({
    total,
    positive,
    negative,
    positiveRate
  });
}

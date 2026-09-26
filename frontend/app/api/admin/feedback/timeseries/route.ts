import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

type Row = {
  day: Date;
  total: bigint;
  positive: bigint;
  negative: bigint;
};

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = (await prisma.$queryRaw`
    SELECT
      date_trunc('day', created_at) AS day,
      COUNT(*)::bigint AS total,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END)::bigint AS positive,
      SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END)::bigint AS negative
    FROM feedbacks
    GROUP BY 1
    ORDER BY 1 ASC
  `) as Row[];

  return NextResponse.json({
    items: rows.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      total: Number(row.total),
      positive: Number(row.positive),
      negative: Number(row.negative)
    }))
  });
}

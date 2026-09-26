import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  content: z.string().trim().min(5).max(2000),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  order: z.number().int().min(0).max(9999),
  isActive: z.boolean().optional()
});

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items: Array<{
    id: string;
    title: string;
    content: string;
    category: string | null;
    order: number;
    isActive: boolean;
    updatedAt: Date;
  }> = await prisma.promptTemplate.findMany({
    orderBy: [{ order: "asc" }, { updatedAt: "desc" }]
  });

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      updatedAt: item.updatedAt.toISOString()
    }))
  });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const created = await prisma.promptTemplate.create({
    data: {
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category || null,
      order: parsed.data.order,
      isActive: parsed.data.isActive ?? true
    }
  });

  return NextResponse.json({
    item: {
      ...created,
      updatedAt: created.updatedAt.toISOString()
    }
  });
}

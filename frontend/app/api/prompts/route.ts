import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export async function GET() {
  const items: Array<{
    id: string;
    title: string;
    content: string;
    category: string | null;
    order: number;
    isActive: boolean;
    updatedAt: Date;
  }> = await prisma.promptTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      content: true,
      category: true,
      order: true,
      isActive: true,
      updatedAt: true
    }
  });

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      updatedAt: item.updatedAt.toISOString()
    }))
  });
}

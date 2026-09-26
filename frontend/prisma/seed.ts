import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function upsertPromptTemplate(input: {
  title: string;
  content: string;
  category?: string;
  order: number;
}) {
  const existing = await prisma.promptTemplate.findFirst({
    where: { title: input.title }
  });

  if (existing) {
    await prisma.promptTemplate.update({
      where: { id: existing.id },
      data: {
        content: input.content,
        category: input.category,
        order: input.order,
        isActive: true
      }
    });
    return;
  }

  await prisma.promptTemplate.create({
    data: {
      title: input.title,
      content: input.content,
      category: input.category,
      order: input.order,
      isActive: true
    }
  });
}

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@hr.local").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin123456!";

  const passwordHash = await hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: "ADMIN"
    },
    create: {
      email: adminEmail,
      passwordHash,
      role: "ADMIN"
    }
  });

  // const templates = [
  //   {
  //     title: "Отпуск",
  //     content: "Какие правила оформления ежегодного отпуска и сроки согласования?",
  //     category: "HR",
  //     order: 10
  //   },
  //   {
  //     title: "Онбординг",
  //     content: "Составь чеклист онбординга сотрудника на первую неделю.",
  //     category: "People Ops",
  //     order: 20
  //   },
  //   {
  //     title: "Оценка",
  //     content: "Какие критерии performance review действуют в компании?",
  //     category: "Performance",
  //     order: 30
  //   }
  // ];

  // for (const template of templates) {
  //   await upsertPromptTemplate(template);
  // }

  // eslint-disable-next-line no-console
  console.log("Seed completed");
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

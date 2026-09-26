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

async function upsertFaqItem(input: {
  question: string;
  answer: string;
  category?: string;
  order: number;
}) {
  const existing = await prisma.faqItem.findFirst({ where: { question: input.question } });
  if (existing) {
    await prisma.faqItem.update({
      where: { id: existing.id },
      data: { ...input, isActive: true }
    });
    return;
  }
  await prisma.faqItem.create({ data: { ...input, isActive: true } });
}

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@civis.local").toLowerCase();
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

  const templates = [
    {
      title: "Acte necesare",
      content: "Ce documente sunt necesare pentru serviciul municipal solicitat?",
      category: "Servicii publice",
      order: 10
    },
    {
      title: "Termen și cost",
      content: "Care este termenul de examinare și ce taxe sunt prevăzute?",
      category: "Servicii publice",
      order: 20
    },
    {
      title: "Depunerea cererii",
      content: "Unde și cum pot depune cererea pentru acest serviciu?",
      category: "Ghid practic",
      order: 30
    }
  ];

  const faqItems = [
    {
      question: "Ce informații poate oferi CIVIS?",
      answer: "CIVIS explică servicii publice și municipale folosind documentele verificate din baza de cunoștințe.",
      category: "Despre CIVIS",
      order: 10
    },
    {
      question: "În ce limbi pot adresa întrebări?",
      answer: "Puteți scrie în română, rusă sau engleză. CIVIS răspunde în limba întrebării.",
      category: "Despre CIVIS",
      order: 20
    },
    {
      question: "Cum verific sursa unui răspuns?",
      answer: "Răspunsurile bazate pe baza de cunoștințe includ documentele-sursă. Deschideți sursa pentru verificare.",
      category: "Siguranță",
      order: 30
    }
  ];

  for (const template of templates) await upsertPromptTemplate(template);
  for (const item of faqItems) await upsertFaqItem(item);

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

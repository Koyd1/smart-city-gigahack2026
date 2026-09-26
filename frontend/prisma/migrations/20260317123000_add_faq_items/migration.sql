CREATE TABLE "faq_items" (
  "id" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "category" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "faq_items_is_active_order_idx" ON "faq_items"("is_active", "order");

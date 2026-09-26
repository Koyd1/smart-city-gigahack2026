-- Create enums
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');
CREATE TYPE "IndexStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR');

-- Create users table
CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'USER',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Create sessions table
CREATE TABLE "sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "persistent" BOOLEAN NOT NULL DEFAULT true,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "terminated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- Create messages table
CREATE TABLE "messages" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "sources" JSONB,
  "hall_score" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "messages_session_id_created_at_idx" ON "messages"("session_id", "created_at");

-- Create feedbacks table
CREATE TABLE "feedbacks" (
  "id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feedbacks_message_id_key" ON "feedbacks"("message_id");
CREATE INDEX "feedbacks_user_id_created_at_idx" ON "feedbacks"("user_id", "created_at");

-- Create knowledge_files table
CREATE TABLE "knowledge_files" (
  "id" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "storage_path" TEXT NOT NULL,
  "status" "IndexStatus" NOT NULL DEFAULT 'PENDING',
  "chunk_count" INTEGER,
  "uploaded_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "knowledge_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_files_status_idx" ON "knowledge_files"("status");

-- Create prompt_templates table
CREATE TABLE "prompt_templates" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "category" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "prompt_templates_is_active_order_idx" ON "prompt_templates"("is_active", "order");

-- Foreign keys
ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages"
  ADD CONSTRAINT "messages_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "feedbacks"
  ADD CONSTRAINT "feedbacks_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "feedbacks"
  ADD CONSTRAINT "feedbacks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

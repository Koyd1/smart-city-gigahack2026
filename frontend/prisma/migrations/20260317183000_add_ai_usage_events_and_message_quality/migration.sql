ALTER TABLE "messages"
  ADD COLUMN "hall_reason" TEXT,
  ADD COLUMN "hall_judge_model" TEXT,
  ADD COLUMN "hall_score_source" TEXT,
  ADD COLUMN "hall_evaluated_at" TIMESTAMP(3);

CREATE TABLE "ai_usage_events" (
  "id" TEXT NOT NULL,
  "session_id" TEXT,
  "message_id" TEXT,
  "operation" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "usage_source" TEXT NOT NULL DEFAULT 'exact',
  "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
  "completion_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "latency_ms" INTEGER,
  "cost_input_usd" DOUBLE PRECISION,
  "cost_output_usd" DOUBLE PRECISION,
  "cost_total_usd" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'ok',
  "error_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_usage_events_session_id_created_at_idx"
  ON "ai_usage_events"("session_id", "created_at");

CREATE INDEX "ai_usage_events_message_id_idx"
  ON "ai_usage_events"("message_id");

CREATE INDEX "ai_usage_events_operation_created_at_idx"
  ON "ai_usage_events"("operation", "created_at");

CREATE INDEX "ai_usage_events_model_created_at_idx"
  ON "ai_usage_events"("model", "created_at");

ALTER TABLE "ai_usage_events"
  ADD CONSTRAINT "ai_usage_events_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

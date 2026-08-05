CREATE TYPE "ServiceRequestEventType" AS ENUM (
  'REQUEST_CREATED',
  'STATUS_CHANGED',
  'COMMENT_ADDED',
  'APPOINTMENT_CREATED',
  'APPOINTMENT_RESCHEDULED',
  'APPOINTMENT_STATUS_CHANGED',
  'QUOTE_CREATED',
  'QUOTE_STATUS_CHANGED',
  'PAYMENT_CREATED',
  'PAYMENT_STATUS_CHANGED'
);

CREATE TYPE "ServiceRequestEventVisibility" AS ENUM ('INTERNAL');

CREATE TABLE "service_request_events" (
  "id" UUID NOT NULL,
  "service_request_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "type" "ServiceRequestEventType" NOT NULL,
  "visibility" "ServiceRequestEventVisibility" NOT NULL DEFAULT 'INTERNAL',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_request_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_request_events_service_request_id_created_at_idx"
ON "service_request_events"("service_request_id", "created_at");

CREATE INDEX "service_request_events_type_idx" ON "service_request_events"("type");

ALTER TABLE "service_request_events" ADD CONSTRAINT "service_request_events_service_request_id_fkey"
FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_request_events" ADD CONSTRAINT "service_request_events_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

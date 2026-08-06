CREATE TYPE "NotificationType" AS ENUM (
  'SERVICE_REQUEST_CREATED', 'SERVICE_REQUEST_STATUS_CHANGED', 'COMMENT_ADDED',
  'APPOINTMENT_CREATED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_STATUS_CHANGED',
  'QUOTE_CREATED', 'QUOTE_STATUS_CHANGED', 'PAYMENT_CREATED', 'PAYMENT_STATUS_CHANGED'
);

CREATE TYPE "NotificationResourceType" AS ENUM ('SERVICE_REQUEST', 'APPOINTMENT', 'QUOTE', 'PAYMENT');

CREATE TABLE "notifications" (
  "id" UUID NOT NULL,
  "recipient_user_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "resource_type" "NotificationResourceType" NOT NULL,
  "resource_id" UUID,
  "metadata" JSONB,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_recipient_user_id_created_at_idx" ON "notifications"("recipient_user_id", "created_at");
CREATE INDEX "notifications_recipient_user_id_read_at_created_at_idx" ON "notifications"("recipient_user_id", "read_at", "created_at");
CREATE INDEX "notifications_type_created_at_idx" ON "notifications"("type", "created_at");
CREATE INDEX "notifications_resource_type_resource_id_idx" ON "notifications"("resource_type", "resource_id");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey"
FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

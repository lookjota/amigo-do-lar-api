-- Existing appointments receive the MVP default duration before the column becomes required.
ALTER TABLE "appointments"
ADD COLUMN "duration_minutes" INTEGER,
ADD COLUMN "started_at" TIMESTAMP(3),
ADD COLUMN "completed_at" TIMESTAMP(3),
ADD COLUMN "cancelled_at" TIMESTAMP(3);

UPDATE "appointments" SET "duration_minutes" = 60 WHERE "duration_minutes" IS NULL;
ALTER TABLE "appointments" ALTER COLUMN "duration_minutes" SET NOT NULL;

-- Keep cancelled appointments as operational history and allow a later replacement.
DROP INDEX "appointments_service_request_id_key";

CREATE INDEX "appointments_service_request_id_idx" ON "appointments"("service_request_id");
CREATE INDEX "appointments_status_scheduled_at_idx" ON "appointments"("status", "scheduled_at");

-- Enforce at database level that only cancelled history can have replacements.
CREATE UNIQUE INDEX "appointments_active_service_request_key"
ON "appointments"("service_request_id")
WHERE "status" <> 'CANCELLED';

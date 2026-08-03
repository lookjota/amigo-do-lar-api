-- AlterTable
ALTER TABLE "service_requests"
ADD COLUMN "address" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "internal_notes" TEXT,
ADD COLUMN "completed_at" TIMESTAMP(3),
ADD COLUMN "cancelled_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "service_requests_created_at_idx" ON "service_requests"("created_at");

-- CreateIndex
CREATE INDEX "service_requests_status_created_at_idx" ON "service_requests"("status", "created_at");

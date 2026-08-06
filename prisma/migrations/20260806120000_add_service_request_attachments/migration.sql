CREATE TYPE "AttachmentCategory" AS ENUM ('BEFORE_SERVICE', 'AFTER_SERVICE', 'RECEIPT', 'DOCUMENT', 'OTHER');

ALTER TYPE "ServiceRequestEventType" ADD VALUE 'ATTACHMENT_ADDED';
ALTER TYPE "ServiceRequestEventType" ADD VALUE 'ATTACHMENT_REMOVED';
ALTER TYPE "NotificationType" ADD VALUE 'ATTACHMENT_ADDED';
ALTER TYPE "NotificationType" ADD VALUE 'ATTACHMENT_REMOVED';

CREATE TABLE "service_request_attachments" (
  "id" UUID NOT NULL,
  "service_request_id" UUID NOT NULL,
  "uploaded_by_user_id" UUID NOT NULL,
  "category" "AttachmentCategory" NOT NULL,
  "original_name" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "checksum" TEXT,
  "caption" TEXT,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "deleted_at" TIMESTAMP(3),
  "deleted_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_request_attachments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "service_request_attachments_storage_key_key" ON "service_request_attachments"("storage_key");
CREATE INDEX "service_request_attachments_service_request_id_created_at_idx" ON "service_request_attachments"("service_request_id", "created_at");
CREATE INDEX "service_request_attachments_service_request_id_category_created_at_idx" ON "service_request_attachments"("service_request_id", "category", "created_at");
CREATE INDEX "service_request_attachments_uploaded_by_user_id_idx" ON "service_request_attachments"("uploaded_by_user_id");
CREATE INDEX "service_request_attachments_is_deleted_created_at_idx" ON "service_request_attachments"("is_deleted", "created_at");
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "service_request_attachments_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "service_request_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "service_request_attachments_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

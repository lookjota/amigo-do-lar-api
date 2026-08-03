-- AlterTable
ALTER TABLE "customers"
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- Existing non-unique indexes are replaced by unique constraints.
DROP INDEX "customers_phone_idx";
DROP INDEX "customers_email_idx";

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- PostgreSQL permits multiple NULL values in a unique index.
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_is_active_idx" ON "customers"("is_active");

-- CreateIndex
CREATE INDEX "customers_created_at_idx" ON "customers"("created_at");

-- CreateIndex
CREATE INDEX "customers_updated_at_idx" ON "customers"("updated_at");

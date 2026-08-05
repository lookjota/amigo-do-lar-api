CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'OTHER');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED');

CREATE TABLE "quotes" (
  "id" UUID NOT NULL,
  "service_request_id" UUID NOT NULL,
  "subtotal_cents" INTEGER NOT NULL,
  "discount_cents" INTEGER NOT NULL DEFAULT 0,
  "total_cents" INTEGER NOT NULL,
  "description" TEXT,
  "notes" TEXT,
  "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
  "valid_until" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "quotes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quotes_non_negative_amounts" CHECK ("subtotal_cents" >= 0 AND "discount_cents" >= 0),
  CONSTRAINT "quotes_valid_total" CHECK ("discount_cents" <= "subtotal_cents" AND "total_cents" = "subtotal_cents" - "discount_cents")
);

CREATE TABLE "payments" (
  "id" UUID NOT NULL,
  "quote_id" UUID NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paid_at" TIMESTAMP(3),
  "reference" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_positive_amount" CHECK ("amount_cents" > 0),
  CONSTRAINT "payments_paid_at_consistency" CHECK ("status" <> 'PAID' OR "paid_at" IS NOT NULL)
);

CREATE UNIQUE INDEX "quotes_service_request_id_key" ON "quotes"("service_request_id");
CREATE INDEX "quotes_status_idx" ON "quotes"("status");
CREATE INDEX "quotes_created_at_idx" ON "quotes"("created_at");
CREATE INDEX "quotes_status_created_at_idx" ON "quotes"("status", "created_at");
CREATE INDEX "payments_quote_id_idx" ON "payments"("quote_id");
CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");
CREATE INDEX "payments_quote_id_status_idx" ON "payments"("quote_id", "status");

ALTER TABLE "quotes" ADD CONSTRAINT "quotes_service_request_id_fkey"
FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_quote_id_fkey"
FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

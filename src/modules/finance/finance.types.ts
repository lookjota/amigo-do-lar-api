import type { PaymentMethod, PaymentStatus, QuoteStatus, ServiceRequestStatus } from '@prisma/client';

export const FINANCE_DEFAULT_LIMIT = 20;
export const FINANCE_MAX_LIMIT = 100;
export const FINANCE_DESCRIPTION_MAX_LENGTH = 2_000;
export const FINANCE_NOTES_MAX_LENGTH = 4_000;
export const PAYMENT_REFERENCE_MAX_LENGTH = 300;

export interface FinanceCustomerSummary { id: string; name: string; phone: string; email: string | null }
export interface FinanceServiceSummary { id: string; name: string; slug: string; category: string }
export interface FinanceServiceRequestSummary {
  id: string; status: ServiceRequestStatus; description: string;
  customer: FinanceCustomerSummary; service: FinanceServiceSummary;
}

export interface QuoteEntity {
  id: string; serviceRequestId: string; subtotalCents: number; discountCents: number; totalCents: number;
  description: string | null; notes: string | null; status: QuoteStatus; validUntil: Date | null;
  approvedAt: Date | null; rejectedAt: Date | null; cancelledAt: Date | null;
  createdAt: Date; updatedAt: Date; serviceRequest: FinanceServiceRequestSummary;
}

export interface PaymentEntity {
  id: string; quoteId: string; amountCents: number; method: PaymentMethod; status: PaymentStatus;
  paidAt: Date | null; reference: string | null; notes: string | null; createdAt: Date; updatedAt: Date;
}

export type FinancialStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type PublicQuote = QuoteEntity & {
  paidTotalCents: number; remainingCents: number; paymentStatus: FinancialStatus;
};

export interface CreateQuoteInput {
  serviceRequestId: string; subtotalCents: number; discountCents?: number;
  description?: string; notes?: string; validUntil?: string | null;
}
export interface QuoteWriteData {
  subtotalCents: number; discountCents: number; totalCents: number;
  description?: string | null; notes?: string | null; validUntil?: Date | null;
}
export interface UpdateQuoteInput {
  subtotalCents?: number; discountCents?: number; description?: string | null;
  notes?: string | null; validUntil?: string | null;
}
export interface UpdateQuoteStatusInput { status: Exclude<QuoteStatus, 'DRAFT'> }
export type QuoteSortBy = 'createdAt' | 'updatedAt' | 'validUntil' | 'status' | 'totalCents';
export interface ListQuotesInput {
  page: number; limit: number; status?: QuoteStatus; serviceRequestId?: string; customerId?: string;
  createdFrom?: string; createdTo?: string; validUntilFrom?: string; validUntilTo?: string;
  orderBy: QuoteSortBy; sortOrder: 'asc' | 'desc';
}
export interface ListQuotesFilters extends Omit<ListQuotesInput, 'createdFrom' | 'createdTo' | 'validUntilFrom' | 'validUntilTo'> {
  createdFrom?: Date; createdTo?: Date; validUntilFrom?: Date; validUntilTo?: Date;
}
export interface QuoteListResult { data: PublicQuote[]; pagination: { page: number; limit: number; total: number; totalPages: number } }

export interface CreatePaymentInput {
  amountCents: number; method: PaymentMethod; status?: Extract<PaymentStatus, 'PENDING' | 'PAID'>;
  paidAt?: string | null; reference?: string; notes?: string;
}
export interface PaymentWriteData {
  amountCents: number; method: PaymentMethod; status: Extract<PaymentStatus, 'PENDING' | 'PAID'>;
  paidAt: Date | null; reference?: string | null; notes?: string | null;
}
export interface UpdatePaymentStatusInput {
  status: Extract<PaymentStatus, 'PAID' | 'CANCELLED' | 'REFUNDED'>; paidAt?: string | null;
}

export type CreateQuoteResult = { outcome: 'created'; quote: QuoteEntity } | { outcome: 'service_request_not_found' } | { outcome: 'service_request_invalid_status'; status: ServiceRequestStatus } | { outcome: 'service_request_status_changed' } | { outcome: 'already_exists' };
export type UpdateQuoteResult = { outcome: 'updated'; quote: QuoteEntity } | { outcome: 'not_found' } | { outcome: 'not_editable'; status: QuoteStatus };
export type QuoteStatusResult = { outcome: 'updated'; quote: QuoteEntity } | { outcome: 'not_found' } | { outcome: 'stale'; status: QuoteStatus } | { outcome: 'has_paid_payments' } | { outcome: 'service_request_sync_failed' };
export type PaymentWriteResult = { outcome: 'created'; payment: PaymentEntity } | { outcome: 'updated'; payment: PaymentEntity } | { outcome: 'quote_not_found' } | { outcome: 'payment_not_found' } | { outcome: 'quote_not_approved' } | { outcome: 'exceeds_remaining' } | { outcome: 'concurrent_conflict' } | { outcome: 'stale'; status: PaymentStatus };

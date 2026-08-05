import type { PaymentStatus, QuoteStatus, UserRole } from '@prisma/client';

import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/http-errors.js';
import type { FinanceRepository } from './finance.repository.js';
import type {
  CreatePaymentInput, CreateQuoteInput, FinancialStatus, ListQuotesInput, PaymentEntity,
  PublicQuote, QuoteEntity, QuoteListResult, UpdatePaymentStatusInput, UpdateQuoteInput,
  UpdateQuoteStatusInput,
} from './finance.types.js';
import { FINANCE_DESCRIPTION_MAX_LENGTH, FINANCE_NOTES_MAX_LENGTH, PAYMENT_REFERENCE_MAX_LENGTH } from './finance.types.js';

const quoteTransitions: Readonly<Record<QuoteStatus, readonly QuoteStatus[]>> = {
  DRAFT: ['SENT', 'CANCELLED'], SENT: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['CANCELLED'], REJECTED: [], CANCELLED: [],
};
const paymentTransitions: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  PENDING: ['PAID', 'CANCELLED'], PAID: ['REFUNDED'], CANCELLED: [], REFUNDED: [],
};

const quoteNotFound = () => new NotFoundError({ code: 'QUOTE_NOT_FOUND', message: 'Quote not found' });
const paymentNotFound = () => new NotFoundError({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' });
function invalid(field: string, message: string, code = 'INVALID_FINANCE_DATA'): BadRequestError {
  return new BadRequestError({ code, message: 'Finance data is invalid', details: [{ field, message }] });
}
function parseDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw invalid(field, `${field} must be a valid ISO 8601 date`);
  return date;
}
function optionalText(value: string | null | undefined, field: string, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  const normalized = value.trim();
  if (normalized.length > max) throw invalid(field, `${field} must have at most ${max} characters`);
  return normalized;
}

export function calculateQuoteTotal(subtotalCents: number, discountCents: number): number {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0) throw invalid('subtotalCents', 'subtotalCents must be a non-negative safe integer');
  if (!Number.isSafeInteger(discountCents) || discountCents < 0) throw invalid('discountCents', 'discountCents must be a non-negative safe integer');
  if (discountCents > subtotalCents) throw new BadRequestError({ code: 'QUOTE_DISCOUNT_EXCEEDS_SUBTOTAL', message: 'Discount cannot exceed subtotal' });
  return subtotalCents - discountCents;
}

export class FinanceService {
  constructor(private readonly repository: FinanceRepository, private readonly now: () => Date = () => new Date()) {}

  async createQuote(input: CreateQuoteInput, actorUserId?: string): Promise<PublicQuote> {
    const discountCents = input.discountCents ?? 0;
    const description = optionalText(input.description, 'description', FINANCE_DESCRIPTION_MAX_LENGTH);
    const notes = optionalText(input.notes, 'notes', FINANCE_NOTES_MAX_LENGTH);
    const result = await this.repository.createQuote(input.serviceRequestId, {
      subtotalCents: input.subtotalCents, discountCents,
      totalCents: calculateQuoteTotal(input.subtotalCents, discountCents),
      ...(description === undefined ? {} : { description }),
      ...(notes === undefined ? {} : { notes }),
      validUntil: input.validUntil == null ? null : parseDate(input.validUntil, 'validUntil'),
    }, actorUserId);
    if (result.outcome === 'service_request_not_found') throw new NotFoundError({ code: 'SERVICE_REQUEST_NOT_FOUND', message: 'Service request not found' });
    if (result.outcome === 'service_request_invalid_status') throw new ConflictError({ code: 'SERVICE_REQUEST_INVALID_STATUS_FOR_QUOTE', message: `Cannot create a quote for a service request in ${result.status}` });
    if (result.outcome === 'service_request_status_changed') throw new ConflictError({ code: 'SERVICE_REQUEST_STATUS_CHANGED', message: 'Service request status changed concurrently' });
    if (result.outcome === 'already_exists') throw new ConflictError({ code: 'QUOTE_ALREADY_EXISTS', message: 'A quote already exists for this service request' });
    return this.withFinancialStatus(result.quote, 0);
  }

  async listQuotes(input: ListQuotesInput): Promise<QuoteListResult> {
    const { createdFrom, createdTo, validUntilFrom, validUntilTo, ...base } = input;
    const filters = {
      ...base,
      ...(createdFrom === undefined ? {} : { createdFrom: parseDate(createdFrom, 'createdFrom') }),
      ...(createdTo === undefined ? {} : { createdTo: parseDate(createdTo, 'createdTo') }),
      ...(validUntilFrom === undefined ? {} : { validUntilFrom: parseDate(validUntilFrom, 'validUntilFrom') }),
      ...(validUntilTo === undefined ? {} : { validUntilTo: parseDate(validUntilTo, 'validUntilTo') }),
    };
    this.range(filters.createdFrom, filters.createdTo, 'createdFrom', 'createdTo');
    this.range(filters.validUntilFrom, filters.validUntilTo, 'validUntilFrom', 'validUntilTo');
    const { data, total } = await this.repository.listQuotes(filters);
    const decorated = await Promise.all(data.map(async (quote) => this.withFinancialStatus(quote, await this.repository.paidTotal(quote.id))));
    return { data: decorated, pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }

  async getQuote(id: string): Promise<PublicQuote> {
    const quote = await this.repository.findQuoteById(id);
    if (quote === null) throw quoteNotFound();
    return this.withFinancialStatus(quote, await this.repository.paidTotal(id));
  }

  async updateQuote(id: string, input: UpdateQuoteInput, role: UserRole): Promise<PublicQuote> {
    const quote = await this.repository.findQuoteById(id);
    if (quote === null) throw quoteNotFound();
    if (quote.status !== 'DRAFT') throw new ConflictError({ code: 'QUOTE_NOT_EDITABLE', message: 'Only draft quotes can be edited' });
    if (role !== 'ADMIN' && role !== 'OPERATOR') throw new ForbiddenError();
    const subtotalCents = input.subtotalCents ?? quote.subtotalCents;
    const discountCents = input.discountCents ?? quote.discountCents;
    const description = optionalText(input.description, 'description', FINANCE_DESCRIPTION_MAX_LENGTH);
    const notes = optionalText(input.notes, 'notes', FINANCE_NOTES_MAX_LENGTH);
    const result = await this.repository.updateQuote(id, {
      ...(input.subtotalCents === undefined ? {} : { subtotalCents }),
      ...(input.discountCents === undefined ? {} : { discountCents }),
      ...((input.subtotalCents === undefined && input.discountCents === undefined) ? {} : { totalCents: calculateQuoteTotal(subtotalCents, discountCents) }),
      ...(description === undefined ? {} : { description }),
      ...(notes === undefined ? {} : { notes }),
      ...(input.validUntil === undefined ? {} : { validUntil: input.validUntil === null ? null : parseDate(input.validUntil, 'validUntil') }),
    });
    if (result.outcome === 'not_found') throw quoteNotFound();
    if (result.outcome === 'not_editable') throw new ConflictError({ code: 'QUOTE_NOT_EDITABLE', message: 'Only draft quotes can be edited' });
    return this.withFinancialStatus(result.quote, await this.repository.paidTotal(id));
  }

  async updateQuoteStatus(id: string, input: UpdateQuoteStatusInput, actorUserId?: string): Promise<PublicQuote> {
    const quote = await this.repository.findQuoteById(id);
    if (quote === null) throw quoteNotFound();
    if (!quoteTransitions[quote.status].includes(input.status)) throw new ConflictError({ code: 'QUOTE_INVALID_STATUS_TRANSITION', message: `Cannot transition quote from ${quote.status} to ${input.status}` });
    const result = await this.repository.updateQuoteStatus(id, quote.status, input.status, this.now(), actorUserId);
    if (result.outcome === 'not_found') throw quoteNotFound();
    if (result.outcome === 'stale') throw new ConflictError({ code: 'QUOTE_INVALID_STATUS_TRANSITION', message: 'Quote status changed concurrently' });
    if (result.outcome === 'has_paid_payments') throw new ConflictError({ code: 'QUOTE_HAS_PAID_PAYMENTS', message: 'A quote with paid payments cannot be cancelled' });
    if (result.outcome === 'service_request_sync_failed') throw new ConflictError({ code: 'QUOTE_SERVICE_REQUEST_SYNC_FAILED', message: 'Quote and service request could not be synchronized' });
    return this.withFinancialStatus(result.quote, await this.repository.paidTotal(id));
  }

  async listPayments(quoteId: string): Promise<PaymentEntity[]> {
    const payments = await this.repository.listPayments(quoteId);
    if (payments === null) throw quoteNotFound();
    return payments;
  }
  async getPayment(id: string): Promise<PaymentEntity> {
    const payment = await this.repository.findPaymentById(id);
    if (payment === null) throw paymentNotFound();
    return payment;
  }

  async createPayment(quoteId: string, input: CreatePaymentInput, actorUserId?: string): Promise<PaymentEntity> {
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw invalid('amountCents', 'amountCents must be a positive safe integer');
    const status = input.status ?? 'PENDING';
    const paidAt = status === 'PAID' ? (input.paidAt == null ? this.now() : parseDate(input.paidAt, 'paidAt')) : null;
    if (status === 'PENDING' && input.paidAt != null) throw invalid('paidAt', 'Pending payments cannot have paidAt');
    const reference = optionalText(input.reference, 'reference', PAYMENT_REFERENCE_MAX_LENGTH);
    const notes = optionalText(input.notes, 'notes', FINANCE_NOTES_MAX_LENGTH);
    const result = await this.repository.createPayment(quoteId, {
      amountCents: input.amountCents, method: input.method, status, paidAt,
      ...(reference === undefined ? {} : { reference }),
      ...(notes === undefined ? {} : { notes }),
    }, actorUserId);
    return this.paymentResult(result);
  }

  async updatePaymentStatus(id: string, input: UpdatePaymentStatusInput, actorUserId?: string): Promise<PaymentEntity> {
    const payment = await this.repository.findPaymentById(id);
    if (payment === null) throw paymentNotFound();
    if (!paymentTransitions[payment.status].includes(input.status)) {
      const final = payment.status === 'CANCELLED' || payment.status === 'REFUNDED';
      throw new ConflictError({ code: final ? 'PAYMENT_ALREADY_FINAL' : 'PAYMENT_INVALID_STATUS_TRANSITION', message: `Cannot transition payment from ${payment.status} to ${input.status}` });
    }
    const paidAt = input.status === 'PAID' ? (input.paidAt == null ? this.now() : parseDate(input.paidAt, 'paidAt')) : payment.paidAt;
    return this.paymentResult(await this.repository.updatePaymentStatus(id, payment.status, input.status, paidAt, actorUserId));
  }

  private paymentResult(result: Awaited<ReturnType<FinanceRepository['createPayment']>>): PaymentEntity {
    if (result.outcome === 'created' || result.outcome === 'updated') return result.payment;
    if (result.outcome === 'quote_not_found') throw quoteNotFound();
    if (result.outcome === 'payment_not_found') throw paymentNotFound();
    if (result.outcome === 'quote_not_approved') throw new ConflictError({ code: 'PAYMENT_REQUIRES_APPROVED_QUOTE', message: 'Payments require an approved quote' });
    if (result.outcome === 'exceeds_remaining') throw new ConflictError({ code: 'PAYMENT_EXCEEDS_REMAINING_AMOUNT', message: 'Payment exceeds the remaining quote amount' });
    if (result.outcome === 'concurrent_conflict') throw new ConflictError({ code: 'FINANCE_CONCURRENT_UPDATE', message: 'Finance data changed concurrently; retry the operation' });
    throw new ConflictError({ code: 'PAYMENT_INVALID_STATUS_TRANSITION', message: 'Payment status changed concurrently' });
  }
  private withFinancialStatus(quote: QuoteEntity, paidTotalCents: number): PublicQuote {
    const remainingCents = Math.max(quote.totalCents - paidTotalCents, 0);
    const paymentStatus: FinancialStatus = paidTotalCents === 0 ? 'UNPAID' : paidTotalCents < quote.totalCents ? 'PARTIALLY_PAID' : 'PAID';
    return { ...quote, paidTotalCents, remainingCents, paymentStatus };
  }
  private range(from: Date | undefined, to: Date | undefined, fromField: string, toField: string): void {
    if (from !== undefined && to !== undefined && from > to) throw invalid(fromField, `${fromField} must be before or equal to ${toField}`);
  }
}

import type { PaymentStatus, QuoteStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { FinanceRepository } from './finance.repository.js';
import { calculateQuoteTotal, FinanceService } from './finance.service.js';
import type { CreateQuoteResult, ListQuotesFilters, PaymentEntity, PaymentWriteData, PaymentWriteResult, QuoteEntity, QuoteStatusResult, QuoteWriteData, UpdateQuoteResult } from './finance.types.js';

const QUOTE_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const PAYMENT_ID = '33333333-3333-4333-8333-333333333333';
const now = new Date('2026-08-05T12:00:00.000Z');
function quote(overrides: Partial<QuoteEntity> = {}): QuoteEntity {
  return { id: QUOTE_ID, serviceRequestId: REQUEST_ID, subtotalCents: 10_000, discountCents: 1_000, totalCents: 9_000, description: null, notes: null, status: 'DRAFT', validUntil: null, approvedAt: null, rejectedAt: null, cancelledAt: null, createdAt: now, updatedAt: now, serviceRequest: { id: REQUEST_ID, status: 'QUOTED', description: 'Repair', customer: { id: '44444444-4444-4444-8444-444444444444', name: 'João', phone: '61999999999', email: null }, service: { id: '55555555-5555-4555-8555-555555555555', name: 'Electrical', slug: 'electrical', category: 'HOME' } }, ...overrides };
}
function payment(overrides: Partial<PaymentEntity> = {}): PaymentEntity {
  return { id: PAYMENT_ID, quoteId: QUOTE_ID, amountCents: 4_000, method: 'PIX', status: 'PENDING', paidAt: null, reference: null, notes: null, createdAt: now, updatedAt: now, ...overrides };
}
class MemoryFinanceRepository implements FinanceRepository {
  quote: QuoteEntity | null = null; payments: PaymentEntity[] = []; requestOutcome: CreateQuoteResult['outcome'] = 'created';
  createQuote(_serviceRequestId: string, input: QuoteWriteData): Promise<CreateQuoteResult> { if (this.requestOutcome === 'service_request_invalid_status') return Promise.resolve({ outcome: this.requestOutcome, status: 'PENDING' }); if (this.requestOutcome !== 'created') return Promise.resolve({ outcome: this.requestOutcome }); this.quote = quote(input); return Promise.resolve({ outcome: 'created', quote: this.quote }); }
  listQuotes(input: ListQuotesFilters) { void input; return Promise.resolve({ data: this.quote === null ? [] : [this.quote], total: this.quote === null ? 0 : 1 }); }
  findQuoteById(id: string) { return Promise.resolve(this.quote?.id === id ? this.quote : null); }
  updateQuote(_id: string, input: Partial<QuoteWriteData>): Promise<UpdateQuoteResult> { if (this.quote === null) return Promise.resolve({ outcome: 'not_found' }); if (this.quote.status !== 'DRAFT') return Promise.resolve({ outcome: 'not_editable', status: this.quote.status }); Object.assign(this.quote, input); return Promise.resolve({ outcome: 'updated', quote: this.quote }); }
  updateQuoteStatus(_id: string, expected: QuoteStatus, next: QuoteStatus, at: Date): Promise<QuoteStatusResult> { if (this.quote === null) return Promise.resolve({ outcome: 'not_found' }); if (this.quote.status !== expected) return Promise.resolve({ outcome: 'stale', status: this.quote.status }); if (next === 'CANCELLED' && this.payments.some((item) => item.status === 'PAID')) return Promise.resolve({ outcome: 'has_paid_payments' }); Object.assign(this.quote, { status: next, approvedAt: next === 'APPROVED' ? at : null, rejectedAt: next === 'REJECTED' ? at : null, cancelledAt: next === 'CANCELLED' ? at : null }); return Promise.resolve({ outcome: 'updated', quote: this.quote }); }
  paidTotal(quoteId: string) { return Promise.resolve(this.payments.filter((item) => item.quoteId === quoteId && item.status === 'PAID').reduce((sum, item) => sum + item.amountCents, 0)); }
  listPayments(quoteId: string) { return Promise.resolve(this.quote?.id === quoteId ? this.payments : null); }
  findPaymentById(id: string) { return Promise.resolve(this.payments.find((item) => item.id === id) ?? null); }
  createPayment(quoteId: string, input: PaymentWriteData): Promise<PaymentWriteResult> { if (this.quote?.id !== quoteId) return Promise.resolve({ outcome: 'quote_not_found' }); if (this.quote.status !== 'APPROVED') return Promise.resolve({ outcome: 'quote_not_approved' }); const paid = this.payments.filter((item) => item.status === 'PAID').reduce((sum, item) => sum + item.amountCents, 0); if (input.status === 'PAID' && paid + input.amountCents > this.quote.totalCents) return Promise.resolve({ outcome: 'exceeds_remaining' }); const created = payment({ ...input, id: `${this.payments.length + 3}3333333-3333-4333-8333-333333333333` }); this.payments.push(created); return Promise.resolve({ outcome: 'created', payment: created }); }
  updatePaymentStatus(id: string, expected: PaymentStatus, next: PaymentStatus, paidAt: Date | null): Promise<PaymentWriteResult> { const current = this.payments.find((item) => item.id === id); if (current === undefined) return Promise.resolve({ outcome: 'payment_not_found' }); if (current.status !== expected) return Promise.resolve({ outcome: 'stale', status: current.status }); if (next === 'PAID') { if (this.quote?.status !== 'APPROVED') return Promise.resolve({ outcome: 'quote_not_approved' }); const paid = this.payments.filter((item) => item.status === 'PAID').reduce((sum, item) => sum + item.amountCents, 0); if (paid + current.amountCents > this.quote.totalCents) return Promise.resolve({ outcome: 'exceeds_remaining' }); } Object.assign(current, { status: next, paidAt }); return Promise.resolve({ outcome: 'updated', payment: current }); }
}

describe('FinanceService quotes', () => {
  it('calculates integer totals and rejects invalid monetary values', () => {
    expect(calculateQuoteTotal(10_000, 1_500)).toBe(8_500);
    expect(() => calculateQuoteTotal(100, 101)).toThrowError(expect.objectContaining({ code: 'QUOTE_DISCOUNT_EXCEEDS_SUBTOTAL' }));
    expect(() => calculateQuoteTotal(10.5, 0)).toThrowError(expect.objectContaining({ code: 'INVALID_FINANCE_DATA' }));
  });
  it.each(['service_request_not_found', 'service_request_invalid_status', 'service_request_status_changed', 'already_exists'] as const)('maps %s to a stable domain error', async (outcome) => {
    const repository = new MemoryFinanceRepository(); repository.requestOutcome = outcome;
    const codes = { service_request_not_found: 'SERVICE_REQUEST_NOT_FOUND', service_request_invalid_status: 'SERVICE_REQUEST_INVALID_STATUS_FOR_QUOTE', service_request_status_changed: 'SERVICE_REQUEST_STATUS_CHANGED', already_exists: 'QUOTE_ALREADY_EXISTS' } as const;
    await expect(new FinanceService(repository).createQuote({ serviceRequestId: REQUEST_ID, subtotalCents: 100 })).rejects.toMatchObject({ code: codes[outcome] });
  });
  it('maps failed approval synchronization to a stable conflict', async () => {
    const repository = new MemoryFinanceRepository(); repository.quote = quote({ status: 'SENT' }); repository.updateQuoteStatus = () => Promise.resolve({ outcome: 'service_request_sync_failed' });
    await expect(new FinanceService(repository).updateQuoteStatus(QUOTE_ID, { status: 'APPROVED' })).rejects.toMatchObject({ code: 'QUOTE_SERVICE_REQUEST_SYNC_FAILED' });
  });
  it('edits drafts, recomputes totals and rejects editing sent quotes', async () => {
    const repository = new MemoryFinanceRepository(); repository.quote = quote(); const service = new FinanceService(repository);
    await expect(service.updateQuote(QUOTE_ID, { subtotalCents: 12_000 }, 'OPERATOR')).resolves.toMatchObject({ totalCents: 11_000 });
    repository.quote.status = 'SENT';
    await expect(service.updateQuote(QUOTE_ID, { notes: 'x' }, 'ADMIN')).rejects.toMatchObject({ code: 'QUOTE_NOT_EDITABLE' });
  });
  it('enforces quote transitions and prevents cancellation with paid history', async () => {
    const repository = new MemoryFinanceRepository(); repository.quote = quote(); const service = new FinanceService(repository, () => now);
    await expect(service.updateQuoteStatus(QUOTE_ID, { status: 'APPROVED' })).rejects.toMatchObject({ code: 'QUOTE_INVALID_STATUS_TRANSITION' });
    await service.updateQuoteStatus(QUOTE_ID, { status: 'SENT' }); repository.payments.push(payment({ status: 'PAID', paidAt: now }));
    await service.updateQuoteStatus(QUOTE_ID, { status: 'APPROVED' });
    await expect(service.updateQuoteStatus(QUOTE_ID, { status: 'CANCELLED' })).rejects.toMatchObject({ code: 'QUOTE_HAS_PAID_PAYMENTS' });
  });
});

describe('FinanceService payments', () => {
  it('does not report an exhausted serialization conflict as an exceeded balance', async () => {
    const repository = new MemoryFinanceRepository(); repository.quote = quote({ status: 'APPROVED' }); repository.createPayment = () => Promise.resolve({ outcome: 'concurrent_conflict' });
    await expect(new FinanceService(repository).createPayment(QUOTE_ID, { amountCents: 100, method: 'PIX' })).rejects.toMatchObject({ code: 'FINANCE_CONCURRENT_UPDATE' });
  });
  it('requires approved quotes, positive integers and enforces remaining amount', async () => {
    const repository = new MemoryFinanceRepository(); repository.quote = quote(); const service = new FinanceService(repository, () => now);
    await expect(service.createPayment(QUOTE_ID, { amountCents: 1_000, method: 'PIX' })).rejects.toMatchObject({ code: 'PAYMENT_REQUIRES_APPROVED_QUOTE' });
    repository.quote.status = 'APPROVED';
    await expect(service.createPayment(QUOTE_ID, { amountCents: 0, method: 'PIX' })).rejects.toMatchObject({ code: 'INVALID_FINANCE_DATA' });
    repository.payments.push(payment({ amountCents: 8_000, status: 'PAID', paidAt: now }));
    await expect(service.createPayment(QUOTE_ID, { amountCents: 1_001, method: 'CASH', status: 'PAID' })).rejects.toMatchObject({ code: 'PAYMENT_EXCEEDS_REMAINING_AMOUNT' });
  });
  it('derives unpaid, partial and paid balances', async () => {
    const repository = new MemoryFinanceRepository(); repository.quote = quote({ status: 'APPROVED' }); const service = new FinanceService(repository);
    await expect(service.getQuote(QUOTE_ID)).resolves.toMatchObject({ paidTotalCents: 0, remainingCents: 9_000, paymentStatus: 'UNPAID' });
    repository.payments.push(payment({ amountCents: 4_000, status: 'PAID', paidAt: now }));
    await expect(service.getQuote(QUOTE_ID)).resolves.toMatchObject({ paidTotalCents: 4_000, remainingCents: 5_000, paymentStatus: 'PARTIALLY_PAID' });
    repository.payments.push(payment({ id: '66666666-6666-4666-8666-666666666666', amountCents: 5_000, status: 'PAID', paidAt: now }));
    await expect(service.getQuote(QUOTE_ID)).resolves.toMatchObject({ remainingCents: 0, paymentStatus: 'PAID' });
  });
  it('applies payment transitions, timestamps and final-state protection', async () => {
    const repository = new MemoryFinanceRepository(); repository.quote = quote({ status: 'APPROVED' }); repository.payments.push(payment()); const service = new FinanceService(repository, () => now);
    await expect(service.updatePaymentStatus(PAYMENT_ID, { status: 'PAID' })).resolves.toMatchObject({ status: 'PAID', paidAt: now });
    await expect(service.updatePaymentStatus(PAYMENT_ID, { status: 'CANCELLED' })).rejects.toMatchObject({ code: 'PAYMENT_INVALID_STATUS_TRANSITION' });
    await expect(service.updatePaymentStatus(PAYMENT_ID, { status: 'REFUNDED' })).resolves.toMatchObject({ status: 'REFUNDED' });
    await expect(service.updatePaymentStatus(PAYMENT_ID, { status: 'PAID' })).rejects.toMatchObject({ code: 'PAYMENT_ALREADY_FINAL' });
  });
});

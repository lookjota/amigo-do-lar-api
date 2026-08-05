import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), findMany: vi.fn(), count: vi.fn(), quoteFind: vi.fn(), paymentAggregate: vi.fn(), txRequestFind: vi.fn(), txRequestUpdateMany: vi.fn(), txQuoteFind: vi.fn(), txQuoteFindOrThrow: vi.fn(), txQuoteCreate: vi.fn(), txQuoteUpdateMany: vi.fn(), txPaymentAggregate: vi.fn(), txPaymentCreate: vi.fn(), txPaymentCount: vi.fn(), txEventCreate: vi.fn() }));
vi.mock('../../shared/database/index.js', () => ({ database: { $transaction: mocks.transaction, quote: { findMany: mocks.findMany, count: mocks.count, findUnique: mocks.quoteFind }, payment: { aggregate: mocks.paymentAggregate } } }));
import { PrismaFinanceRepository } from './finance.repository.js';

const tx = { serviceRequest: { findUnique: mocks.txRequestFind, updateMany: mocks.txRequestUpdateMany }, quote: { findUnique: mocks.txQuoteFind, findUniqueOrThrow: mocks.txQuoteFindOrThrow, create: mocks.txQuoteCreate, updateMany: mocks.txQuoteUpdateMany }, payment: { aggregate: mocks.txPaymentAggregate, create: mocks.txPaymentCreate, count: mocks.txPaymentCount }, serviceRequestEvent: { create: mocks.txEventCreate } };
beforeEach(() => { vi.clearAllMocks(); mocks.transaction.mockImplementation(async (argument: unknown, options?: unknown) => { void options; if (typeof argument === 'function') return (argument as (client: typeof tx) => unknown)(tx); return Promise.all(argument as Promise<unknown>[]); }); mocks.findMany.mockResolvedValue([]); mocks.count.mockResolvedValue(0); mocks.txRequestUpdateMany.mockResolvedValue({ count: 1 }); mocks.txQuoteUpdateMany.mockResolvedValue({ count: 1 }); mocks.txPaymentCount.mockResolvedValue(0); mocks.txEventCreate.mockResolvedValue({ id: 'event' }); });

describe('PrismaFinanceRepository', () => {
  it('maps filters, customer relation, ordering and pagination', async () => {
    await new PrismaFinanceRepository().listQuotes({ page: 2, limit: 10, status: 'SENT', customerId: '11111111-1111-4111-8111-111111111111', createdFrom: new Date('2026-08-01'), createdTo: new Date('2026-08-05'), orderBy: 'totalCents', sortOrder: 'asc' });
    const call = mocks.findMany.mock.calls[0]?.[0] as { where: { status: string; serviceRequest: { customerId: string } }; orderBy: object; skip: number; take: number; include: object };
    expect(call.where.status).toBe('SENT'); expect(call.where.serviceRequest.customerId).toBe('11111111-1111-4111-8111-111111111111'); expect(call.orderBy).toEqual({ totalCents: 'asc' }); expect({ skip: call.skip, take: call.take }).toEqual({ skip: 10, take: 10 }); expect(call.include).toHaveProperty('serviceRequest');
  });
  it('creates a unique quote with the request check in one serializable transaction', async () => {
    mocks.txRequestFind.mockResolvedValue({ status: 'CONTACTED' }); mocks.txQuoteFind.mockResolvedValue(null); mocks.txQuoteCreate.mockResolvedValue({ id: 'quote' }); mocks.txQuoteFindOrThrow.mockResolvedValue({ id: 'quote', serviceRequestId: 'request' });
    await expect(new PrismaFinanceRepository().createQuote('request', { subtotalCents: 100, discountCents: 10, totalCents: 90 })).resolves.toEqual({ outcome: 'created', quote: { id: 'quote', serviceRequestId: 'request' } });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    expect(mocks.txQuoteCreate).toHaveBeenCalledBefore(mocks.txRequestUpdateMany); expect(mocks.txRequestUpdateMany).toHaveBeenCalledWith({ where: { id: 'request', status: 'CONTACTED' }, data: { status: 'QUOTED' } });
  });
  it('does not create a quote when the request cannot transition to QUOTED', async () => {
    mocks.txRequestFind.mockResolvedValue({ status: 'SCHEDULED' });
    await expect(new PrismaFinanceRepository().createQuote('request', { subtotalCents: 100, discountCents: 0, totalCents: 100 })).resolves.toEqual({ outcome: 'service_request_invalid_status', status: 'SCHEDULED' });
    expect(mocks.txQuoteCreate).not.toHaveBeenCalled();
  });
  it('rolls back quote creation when the conditional request transition loses a race', async () => {
    mocks.txRequestFind.mockResolvedValue({ status: 'CONTACTED' }); mocks.txQuoteFind.mockResolvedValue(null); mocks.txQuoteCreate.mockResolvedValue({ id: 'quote' }); mocks.txRequestUpdateMany.mockResolvedValue({ count: 0 });
    await expect(new PrismaFinanceRepository().createQuote('request', { subtotalCents: 100, discountCents: 0, totalCents: 100 })).resolves.toEqual({ outcome: 'service_request_status_changed' });
    expect(mocks.txQuoteFindOrThrow).not.toHaveBeenCalled();
  });
  it('updates quote and service request atomically on approval', async () => {
    mocks.txQuoteFindOrThrow.mockResolvedValueOnce({ serviceRequestId: 'request' }).mockResolvedValueOnce({ id: 'quote', serviceRequestId: 'request', status: 'APPROVED' });
    await expect(new PrismaFinanceRepository().updateQuoteStatus('quote', 'SENT', 'APPROVED', new Date())).resolves.toMatchObject({ outcome: 'updated', quote: { status: 'APPROVED' } });
    expect(mocks.txRequestUpdateMany).toHaveBeenCalledWith({ where: { id: 'request', status: 'QUOTED' }, data: { status: 'APPROVED' } });
  });
  it('fails approval without returning a partially updated quote when the request is not QUOTED', async () => {
    mocks.txQuoteFindOrThrow.mockResolvedValue({ serviceRequestId: 'request' }); mocks.txRequestUpdateMany.mockResolvedValue({ count: 0 });
    await expect(new PrismaFinanceRepository().updateQuoteStatus('quote', 'SENT', 'APPROVED', new Date())).resolves.toEqual({ outcome: 'service_request_sync_failed' });
  });
  it('conditionally edits only a DRAFT quote and reports a concurrent status change', async () => {
    mocks.txQuoteUpdateMany.mockResolvedValue({ count: 0 }); mocks.txQuoteFind.mockResolvedValue({ status: 'SENT' });
    await expect(new PrismaFinanceRepository().updateQuote('quote', { notes: 'changed' })).resolves.toEqual({ outcome: 'not_editable', status: 'SENT' });
    expect(mocks.txQuoteUpdateMany).toHaveBeenCalledWith({ where: { id: 'quote', status: 'DRAFT' }, data: { notes: 'changed' } });
  });
  it('checks the paid sum and writes a payment in one serializable transaction', async () => {
    mocks.txQuoteFind.mockResolvedValue({ status: 'APPROVED', totalCents: 1_000 }); mocks.txPaymentAggregate.mockResolvedValue({ _sum: { amountCents: 400 } }); mocks.txPaymentCreate.mockResolvedValue({ id: 'payment' });
    await expect(new PrismaFinanceRepository().createPayment('quote', { amountCents: 600, method: 'PIX', status: 'PAID', paidAt: new Date() })).resolves.toEqual({ outcome: 'created', payment: { id: 'payment' } });
    expect(mocks.txPaymentAggregate).toHaveBeenCalledBefore(mocks.txPaymentCreate); expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });
  it('refuses a payment that exceeds the remaining amount', async () => {
    mocks.txQuoteFind.mockResolvedValue({ status: 'APPROVED', totalCents: 1_000 }); mocks.txPaymentAggregate.mockResolvedValue({ _sum: { amountCents: 500 } });
    await expect(new PrismaFinanceRepository().createPayment('quote', { amountCents: 501, method: 'PIX', status: 'PAID', paidAt: new Date() })).resolves.toEqual({ outcome: 'exceeds_remaining' });
    expect(mocks.txPaymentCreate).not.toHaveBeenCalled();
  });
  it('retries P2034 and succeeds without misreporting a balance error', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' });
    mocks.transaction.mockRejectedValueOnce(conflict).mockImplementationOnce((argument: unknown) => (argument as (client: typeof tx) => unknown)(tx));
    mocks.txQuoteFind.mockResolvedValue({ status: 'APPROVED', totalCents: 1_000 }); mocks.txPaymentAggregate.mockResolvedValue({ _sum: { amountCents: 0 } }); mocks.txPaymentCreate.mockResolvedValue({ id: 'payment' });
    await expect(new PrismaFinanceRepository().createPayment('quote', { amountCents: 500, method: 'PIX', status: 'PAID', paidAt: new Date() })).resolves.toMatchObject({ outcome: 'created' });
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });
  it('returns concurrent_conflict after bounded P2034 retries', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' }); mocks.transaction.mockRejectedValue(conflict);
    await expect(new PrismaFinanceRepository().createPayment('quote', { amountCents: 500, method: 'PIX', status: 'PAID', paidAt: new Date() })).resolves.toEqual({ outcome: 'concurrent_conflict' });
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
  });
  it('rechecks the paid total after a concurrent conflict and cannot exceed the quote total', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' });
    mocks.transaction.mockRejectedValueOnce(conflict).mockImplementationOnce((argument: unknown) => (argument as (client: typeof tx) => unknown)(tx));
    mocks.txQuoteFind.mockResolvedValue({ status: 'APPROVED', totalCents: 1_000 }); mocks.txPaymentAggregate.mockResolvedValue({ _sum: { amountCents: 600 } });
    await expect(new PrismaFinanceRepository().createPayment('quote', { amountCents: 500, method: 'PIX', status: 'PAID', paidAt: new Date() })).resolves.toEqual({ outcome: 'exceeds_remaining' });
    expect(mocks.txPaymentCreate).not.toHaveBeenCalled();
  });
});

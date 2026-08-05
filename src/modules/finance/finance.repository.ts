import { Prisma, type PaymentStatus, type QuoteStatus } from '@prisma/client';

import { database } from '../../shared/database/index.js';
import type {
  CreateQuoteResult, ListQuotesFilters, PaymentEntity, PaymentWriteData, PaymentWriteResult,
  QuoteEntity, QuoteStatusResult, QuoteWriteData, UpdateQuoteResult,
} from './finance.types.js';
import { canTransitionServiceRequestStatus } from '../service-requests/service-request-status.js';

const quoteRelations = {
  serviceRequest: { select: {
    id: true, status: true, description: true,
    customer: { select: { id: true, name: true, phone: true, email: true } },
    service: { select: { id: true, name: true, slug: true, category: true } },
  } },
} satisfies Prisma.QuoteInclude;

export interface FinanceRepository {
  createQuote(serviceRequestId: string, input: QuoteWriteData): Promise<CreateQuoteResult>;
  listQuotes(input: ListQuotesFilters): Promise<{ data: QuoteEntity[]; total: number }>;
  findQuoteById(id: string): Promise<QuoteEntity | null>;
  updateQuote(id: string, input: Partial<QuoteWriteData>): Promise<UpdateQuoteResult>;
  updateQuoteStatus(id: string, expected: QuoteStatus, next: QuoteStatus, at: Date): Promise<QuoteStatusResult>;
  paidTotal(quoteId: string): Promise<number>;
  listPayments(quoteId: string): Promise<PaymentEntity[] | null>;
  findPaymentById(id: string): Promise<PaymentEntity | null>;
  createPayment(quoteId: string, input: PaymentWriteData): Promise<PaymentWriteResult>;
  updatePaymentStatus(id: string, expected: PaymentStatus, next: PaymentStatus, paidAt: Date | null): Promise<PaymentWriteResult>;
}

function serializableConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}
function uniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

const SERIALIZABLE_ATTEMPTS = 3;
async function serializableTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let attempts = 0;
  while (true) {
    try {
      return await database.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      attempts += 1;
      if (!serializableConflict(error) || attempts >= SERIALIZABLE_ATTEMPTS) throw error;
    }
  }
}

class QuoteSynchronizationError extends Error {
  constructor(readonly outcome: 'service_request_status_changed' | 'service_request_sync_failed') { super(outcome); }
}

export class PrismaFinanceRepository implements FinanceRepository {
  async createQuote(serviceRequestId: string, input: QuoteWriteData): Promise<CreateQuoteResult> {
    try {
      return await serializableTransaction(async (tx) => {
        const request = await tx.serviceRequest.findUnique({ where: { id: serviceRequestId }, select: { status: true } });
        if (request === null) return { outcome: 'service_request_not_found' };
        if (!canTransitionServiceRequestStatus(request.status, 'QUOTED')) return { outcome: 'service_request_invalid_status', status: request.status };
        const existing = await tx.quote.findUnique({ where: { serviceRequestId }, select: { id: true } });
        if (existing !== null) return { outcome: 'already_exists' };
        await tx.quote.create({ data: { serviceRequestId, ...input } });
        const transitioned = await tx.serviceRequest.updateMany({ where: { id: serviceRequestId, status: request.status }, data: { status: 'QUOTED' } });
        if (transitioned.count !== 1) throw new QuoteSynchronizationError('service_request_status_changed');
        return { outcome: 'created', quote: await tx.quote.findUniqueOrThrow({ where: { serviceRequestId }, include: quoteRelations }) };
      });
    } catch (error) {
      if (error instanceof QuoteSynchronizationError && error.outcome === 'service_request_status_changed') return { outcome: error.outcome };
      if (uniqueConflict(error)) return { outcome: 'already_exists' };
      throw error;
    }
  }

  async listQuotes(input: ListQuotesFilters): Promise<{ data: QuoteEntity[]; total: number }> {
    const range = (from?: Date, to?: Date) => ({ ...(from === undefined ? {} : { gte: from }), ...(to === undefined ? {} : { lte: to }) });
    const where: Prisma.QuoteWhereInput = {
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.serviceRequestId === undefined ? {} : { serviceRequestId: input.serviceRequestId }),
      ...(input.customerId === undefined ? {} : { serviceRequest: { customerId: input.customerId } }),
      ...(input.createdFrom === undefined && input.createdTo === undefined ? {} : { createdAt: range(input.createdFrom, input.createdTo) }),
      ...(input.validUntilFrom === undefined && input.validUntilTo === undefined ? {} : { validUntil: range(input.validUntilFrom, input.validUntilTo) }),
    };
    const [data, total] = await database.$transaction([
      database.quote.findMany({ where, include: quoteRelations, orderBy: { [input.orderBy]: input.sortOrder }, skip: (input.page - 1) * input.limit, take: input.limit }),
      database.quote.count({ where }),
    ]);
    return { data, total };
  }

  findQuoteById(id: string): Promise<QuoteEntity | null> {
    return database.quote.findUnique({ where: { id }, include: quoteRelations });
  }
  async updateQuote(id: string, input: Partial<QuoteWriteData>): Promise<UpdateQuoteResult> {
    return database.$transaction(async (tx) => {
      const result = await tx.quote.updateMany({ where: { id, status: 'DRAFT' }, data: input });
      if (result.count === 0) {
        const current = await tx.quote.findUnique({ where: { id }, select: { status: true } });
        return current === null ? { outcome: 'not_found' } : { outcome: 'not_editable', status: current.status };
      }
      return { outcome: 'updated', quote: await tx.quote.findUniqueOrThrow({ where: { id }, include: quoteRelations }) };
    });
  }

  async updateQuoteStatus(id: string, expected: QuoteStatus, next: QuoteStatus, at: Date): Promise<QuoteStatusResult> {
    try {
      return await serializableTransaction(async (tx) => {
      if (next === 'CANCELLED') {
        const paid = await tx.payment.count({ where: { quoteId: id, status: 'PAID' } });
        if (paid > 0) return { outcome: 'has_paid_payments' };
      }
      const result = await tx.quote.updateMany({ where: { id, status: expected }, data: {
        status: next,
        approvedAt: next === 'APPROVED' ? at : null,
        rejectedAt: next === 'REJECTED' ? at : null,
        cancelledAt: next === 'CANCELLED' ? at : null,
      } });
      if (result.count === 0) {
        const current = await tx.quote.findUnique({ where: { id }, select: { status: true } });
        return current === null ? { outcome: 'not_found' } : { outcome: 'stale', status: current.status };
      }
      if (next === 'APPROVED') {
        const current = await tx.quote.findUniqueOrThrow({ where: { id }, select: { serviceRequestId: true } });
        const transitioned = await tx.serviceRequest.updateMany({ where: { id: current.serviceRequestId, status: 'QUOTED' }, data: { status: 'APPROVED' } });
        if (transitioned.count !== 1) throw new QuoteSynchronizationError('service_request_sync_failed');
      }
      return { outcome: 'updated', quote: await tx.quote.findUniqueOrThrow({ where: { id }, include: quoteRelations }) };
      });
    } catch (error) {
      if (error instanceof QuoteSynchronizationError && error.outcome === 'service_request_sync_failed') return { outcome: error.outcome };
      throw error;
    }
  }

  async paidTotal(quoteId: string): Promise<number> {
    const aggregate = await database.payment.aggregate({ where: { quoteId, status: 'PAID' }, _sum: { amountCents: true } });
    return aggregate._sum.amountCents ?? 0;
  }
  async listPayments(quoteId: string): Promise<PaymentEntity[] | null> {
    if ((await database.quote.findUnique({ where: { id: quoteId }, select: { id: true } })) === null) return null;
    return database.payment.findMany({ where: { quoteId }, orderBy: { createdAt: 'desc' } });
  }
  findPaymentById(id: string): Promise<PaymentEntity | null> {
    return database.payment.findUnique({ where: { id } });
  }

  async createPayment(quoteId: string, input: PaymentWriteData): Promise<PaymentWriteResult> {
    try {
      return await serializableTransaction(async (tx) => {
        const quote = await tx.quote.findUnique({ where: { id: quoteId }, select: { status: true, totalCents: true } });
        if (quote === null) return { outcome: 'quote_not_found' };
        if (quote.status !== 'APPROVED') return { outcome: 'quote_not_approved' };
        if (input.status === 'PAID') {
          const aggregate = await tx.payment.aggregate({ where: { quoteId, status: 'PAID' }, _sum: { amountCents: true } });
          if ((aggregate._sum.amountCents ?? 0) + input.amountCents > quote.totalCents) return { outcome: 'exceeds_remaining' };
        }
        return { outcome: 'created', payment: await tx.payment.create({ data: { quoteId, ...input } }) };
      });
    } catch (error) {
      if (serializableConflict(error)) return { outcome: 'concurrent_conflict' };
      throw error;
    }
  }

  async updatePaymentStatus(id: string, expected: PaymentStatus, next: PaymentStatus, paidAt: Date | null): Promise<PaymentWriteResult> {
    try {
      return await serializableTransaction(async (tx) => {
        const payment = await tx.payment.findUnique({ where: { id }, include: { quote: { select: { status: true, totalCents: true } } } });
        if (payment === null) return { outcome: 'payment_not_found' };
        if (payment.status !== expected) return { outcome: 'stale', status: payment.status };
        if (next === 'PAID') {
          if (payment.quote.status !== 'APPROVED') return { outcome: 'quote_not_approved' };
          const aggregate = await tx.payment.aggregate({ where: { quoteId: payment.quoteId, status: 'PAID' }, _sum: { amountCents: true } });
          if ((aggregate._sum.amountCents ?? 0) + payment.amountCents > payment.quote.totalCents) return { outcome: 'exceeds_remaining' };
        }
        const result = await tx.payment.updateMany({ where: { id, status: expected }, data: { status: next, paidAt } });
        if (result.count === 0) {
          const current = await tx.payment.findUnique({ where: { id }, select: { status: true } });
          return current === null ? { outcome: 'payment_not_found' } : { outcome: 'stale', status: current.status };
        }
        return { outcome: 'updated', payment: await tx.payment.findUniqueOrThrow({ where: { id } }) };
      });
    } catch (error) {
      if (serializableConflict(error)) return { outcome: 'concurrent_conflict' };
      throw error;
    }
  }
}

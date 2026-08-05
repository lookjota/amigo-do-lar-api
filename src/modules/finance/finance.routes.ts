import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/auth/authenticate.js';
import { authorize } from '../../shared/auth/authorize.js';
import { FinanceController } from './finance.controller.js';
import type { FinanceRepository } from './finance.repository.js';
import { createPaymentSchema, createQuoteSchema, getPaymentSchema, getQuoteSchema, listPaymentsSchema, listQuotesSchema, updatePaymentStatusSchema, updateQuoteSchema, updateQuoteStatusSchema } from './finance.schemas.js';
import { FinanceService } from './finance.service.js';
import type { CreatePaymentInput, CreateQuoteInput, ListQuotesInput, UpdatePaymentStatusInput, UpdateQuoteInput, UpdateQuoteStatusInput } from './finance.types.js';

export function registerFinanceRoutes(app: FastifyInstance, repository: FinanceRepository): void {
  const controller = new FinanceController(new FinanceService(repository));
  const staff = [authenticate, authorize(['ADMIN', 'OPERATOR'])];
  const admin = [authenticate, authorize(['ADMIN'])];
  app.get<{ Querystring: ListQuotesInput }>('/quotes', { schema: listQuotesSchema, onRequest: staff }, controller.listQuotes);
  app.get<{ Params: { id: string } }>('/quotes/:id', { schema: getQuoteSchema, onRequest: staff }, controller.getQuote);
  app.post<{ Body: CreateQuoteInput }>('/quotes', { schema: createQuoteSchema, onRequest: staff }, controller.createQuote);
  app.patch<{ Params: { id: string }; Body: UpdateQuoteInput }>('/quotes/:id', { schema: updateQuoteSchema, onRequest: staff }, controller.updateQuote);
  app.patch<{ Params: { id: string }; Body: UpdateQuoteStatusInput }>('/quotes/:id/status', { schema: updateQuoteStatusSchema, onRequest: admin }, controller.updateQuoteStatus);
  app.get<{ Params: { quoteId: string } }>('/quotes/:quoteId/payments', { schema: listPaymentsSchema, onRequest: staff }, controller.listPayments);
  app.get<{ Params: { id: string } }>('/payments/:id', { schema: getPaymentSchema, onRequest: staff }, controller.getPayment);
  app.post<{ Params: { quoteId: string }; Body: CreatePaymentInput }>('/quotes/:quoteId/payments', { schema: createPaymentSchema, onRequest: admin }, controller.createPayment);
  app.patch<{ Params: { id: string }; Body: UpdatePaymentStatusInput }>('/payments/:id/status', { schema: updatePaymentStatusSchema, onRequest: admin }, controller.updatePaymentStatus);
}

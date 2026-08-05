import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FinanceService } from './finance.service.js';
import type { CreatePaymentInput, CreateQuoteInput, ListQuotesInput, UpdatePaymentStatusInput, UpdateQuoteInput, UpdateQuoteStatusInput } from './finance.types.js';

interface IdParams { id: string }
interface QuoteIdParams { quoteId: string }
export class FinanceController {
  constructor(private readonly service: FinanceService) {}
  createQuote = async (request: FastifyRequest<{ Body: CreateQuoteInput }>, reply: FastifyReply): Promise<void> => { await reply.status(201).send(await this.service.createQuote(request.body, request.user.sub)); };
  listQuotes = async (request: FastifyRequest<{ Querystring: ListQuotesInput }>, reply: FastifyReply): Promise<void> => { await reply.send(await this.service.listQuotes(request.query)); };
  getQuote = async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply): Promise<void> => { await reply.send(await this.service.getQuote(request.params.id)); };
  updateQuote = async (request: FastifyRequest<{ Params: IdParams; Body: UpdateQuoteInput }>, reply: FastifyReply): Promise<void> => { await reply.send(await this.service.updateQuote(request.params.id, request.body, request.user.role)); };
  updateQuoteStatus = async (request: FastifyRequest<{ Params: IdParams; Body: UpdateQuoteStatusInput }>, reply: FastifyReply): Promise<void> => { await reply.send(await this.service.updateQuoteStatus(request.params.id, request.body, request.user.sub)); };
  listPayments = async (request: FastifyRequest<{ Params: QuoteIdParams }>, reply: FastifyReply): Promise<void> => { await reply.send(await this.service.listPayments(request.params.quoteId)); };
  getPayment = async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply): Promise<void> => { await reply.send(await this.service.getPayment(request.params.id)); };
  createPayment = async (request: FastifyRequest<{ Params: QuoteIdParams; Body: CreatePaymentInput }>, reply: FastifyReply): Promise<void> => { await reply.status(201).send(await this.service.createPayment(request.params.quoteId, request.body, request.user.sub)); };
  updatePaymentStatus = async (request: FastifyRequest<{ Params: IdParams; Body: UpdatePaymentStatusInput }>, reply: FastifyReply): Promise<void> => { await reply.send(await this.service.updatePaymentStatus(request.params.id, request.body, request.user.sub)); };
}

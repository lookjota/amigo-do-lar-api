import { FINANCE_DEFAULT_LIMIT, FINANCE_DESCRIPTION_MAX_LENGTH, FINANCE_MAX_LIMIT, FINANCE_NOTES_MAX_LENGTH, PAYMENT_REFERENCE_MAX_LENGTH } from './finance.types.js';

const quoteStatuses = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
const paymentMethods = ['PIX', 'CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'OTHER'] as const;
const paymentStatuses = ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'] as const;
const nullableDate = { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] } as const;
const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] } as const;
const idParams = { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } as const;
const quoteIdParams = { type: 'object', additionalProperties: false, required: ['quoteId'], properties: { quoteId: { type: 'string', format: 'uuid' } } } as const;

const customer = { type: 'object', additionalProperties: false, required: ['id', 'name', 'phone', 'email'], properties: {
  id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, phone: { type: 'string' }, email: nullableString,
} } as const;
const service = { type: 'object', additionalProperties: false, required: ['id', 'name', 'slug', 'category'], properties: {
  id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, slug: { type: 'string' }, category: { type: 'string' },
} } as const;
const serviceRequest = { type: 'object', additionalProperties: false, required: ['id', 'status', 'description', 'customer', 'service'], properties: {
  id: { type: 'string', format: 'uuid' }, status: { type: 'string' }, description: { type: 'string' }, customer, service,
} } as const;
const quoteResponse = { type: 'object', additionalProperties: false, required: [
  'id', 'serviceRequestId', 'subtotalCents', 'discountCents', 'totalCents', 'description', 'notes', 'status',
  'validUntil', 'approvedAt', 'rejectedAt', 'cancelledAt', 'createdAt', 'updatedAt', 'serviceRequest',
  'paidTotalCents', 'remainingCents', 'paymentStatus',
], properties: {
  id: { type: 'string', format: 'uuid' }, serviceRequestId: { type: 'string', format: 'uuid' },
  subtotalCents: { type: 'integer' }, discountCents: { type: 'integer' }, totalCents: { type: 'integer' },
  description: nullableString, notes: nullableString, status: { type: 'string', enum: quoteStatuses }, validUntil: nullableDate,
  approvedAt: nullableDate, rejectedAt: nullableDate, cancelledAt: nullableDate,
  createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
  serviceRequest, paidTotalCents: { type: 'integer' }, remainingCents: { type: 'integer' },
  paymentStatus: { type: 'string', enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'] },
} } as const;
const paymentResponse = { type: 'object', additionalProperties: false, required: [
  'id', 'quoteId', 'amountCents', 'method', 'status', 'paidAt', 'reference', 'notes', 'createdAt', 'updatedAt',
], properties: {
  id: { type: 'string', format: 'uuid' }, quoteId: { type: 'string', format: 'uuid' }, amountCents: { type: 'integer' },
  method: { type: 'string', enum: paymentMethods }, status: { type: 'string', enum: paymentStatuses }, paidAt: nullableDate,
  reference: nullableString, notes: nullableString, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
} } as const;

export const createQuoteSchema = { body: { type: 'object', additionalProperties: false, required: ['serviceRequestId', 'subtotalCents'], properties: {
  serviceRequestId: { type: 'string', format: 'uuid' }, subtotalCents: { type: 'integer', minimum: 0 }, discountCents: { type: 'integer', minimum: 0, default: 0 },
  description: { type: 'string', maxLength: FINANCE_DESCRIPTION_MAX_LENGTH }, notes: { type: 'string', maxLength: FINANCE_NOTES_MAX_LENGTH }, validUntil: nullableDate,
} }, response: { 201: quoteResponse } } as const;
export const listQuotesSchema = { querystring: { type: 'object', additionalProperties: false, properties: {
  page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: FINANCE_MAX_LIMIT, default: FINANCE_DEFAULT_LIMIT },
  status: { type: 'string', enum: quoteStatuses }, serviceRequestId: { type: 'string', format: 'uuid' }, customerId: { type: 'string', format: 'uuid' },
  createdFrom: { type: 'string', format: 'date-time' }, createdTo: { type: 'string', format: 'date-time' },
  validUntilFrom: { type: 'string', format: 'date-time' }, validUntilTo: { type: 'string', format: 'date-time' },
  orderBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'validUntil', 'status', 'totalCents'], default: 'createdAt' }, sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
} }, response: { 200: { type: 'object', additionalProperties: false, required: ['data', 'pagination'], properties: {
  data: { type: 'array', items: quoteResponse }, pagination: { type: 'object', additionalProperties: false, required: ['page', 'limit', 'total', 'totalPages'], properties: {
    page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' },
  } },
} } } } as const;
export const getQuoteSchema = { params: idParams, response: { 200: quoteResponse } } as const;
export const updateQuoteSchema = { params: idParams, body: { type: 'object', additionalProperties: false, minProperties: 1, properties: {
  subtotalCents: { type: 'integer', minimum: 0 }, discountCents: { type: 'integer', minimum: 0 },
  description: { anyOf: [{ type: 'string', maxLength: FINANCE_DESCRIPTION_MAX_LENGTH }, { type: 'null' }] },
  notes: { anyOf: [{ type: 'string', maxLength: FINANCE_NOTES_MAX_LENGTH }, { type: 'null' }] }, validUntil: nullableDate,
} }, response: { 200: quoteResponse } } as const;
export const updateQuoteStatusSchema = { params: idParams, body: { type: 'object', additionalProperties: false, required: ['status'], properties: {
  status: { type: 'string', enum: ['SENT', 'APPROVED', 'REJECTED', 'CANCELLED'] },
} }, response: { 200: quoteResponse } } as const;
export const listPaymentsSchema = { params: quoteIdParams, response: { 200: { type: 'array', items: paymentResponse } } } as const;
export const getPaymentSchema = { params: idParams, response: { 200: paymentResponse } } as const;
export const createPaymentSchema = { params: quoteIdParams, body: { type: 'object', additionalProperties: false, required: ['amountCents', 'method'], properties: {
  amountCents: { type: 'integer', minimum: 1 }, method: { type: 'string', enum: paymentMethods }, status: { type: 'string', enum: ['PENDING', 'PAID'], default: 'PENDING' },
  paidAt: nullableDate, reference: { type: 'string', maxLength: PAYMENT_REFERENCE_MAX_LENGTH }, notes: { type: 'string', maxLength: FINANCE_NOTES_MAX_LENGTH },
} }, response: { 201: paymentResponse } } as const;
export const updatePaymentStatusSchema = { params: idParams, body: { type: 'object', additionalProperties: false, required: ['status'], properties: {
  status: { type: 'string', enum: ['PAID', 'CANCELLED', 'REFUNDED'] }, paidAt: nullableDate,
} }, response: { 200: paymentResponse } } as const;

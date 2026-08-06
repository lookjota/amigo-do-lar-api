import type { FastifyInstance } from 'fastify';
import type { UserRole } from '@prisma/client';
import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import type { ServiceRequestActivityRepository } from './service-request-activity.repository.js';
import type {
  ActivityEvent, ActivityListResult, ListActivityRepositoryInput,
} from './service-request-activity.types.js';

const requestId = '11111111-1111-4111-8111-111111111111';
const userId = '33333333-3333-4333-8333-333333333333';
const activity: ActivityEvent = {
  id: '22222222-2222-4222-8222-222222222222', serviceRequestId: requestId, type: 'PAYMENT_STATUS_CHANGED',
  title: 'Status do pagamento alterado', description: null, createdAt: new Date('2026-08-05T12:00:00.000Z'),
  metadata: { paymentId: '44444444-4444-4444-8444-444444444444', quoteId: '55555555-5555-4555-8555-555555555555', from: 'PENDING', to: 'PAID', amountCents: 10000, storageKey: 'secret' },
  actor: { id: userId, name: 'Equipe', email: 'equipe@example.com', role: 'OPERATOR' },
};
class MemoryRepository implements ServiceRequestActivityRepository {
  exists = true; lastInput?: ListActivityRepositoryInput; events: ActivityEvent[] = [activity];
  serviceRequestExists(): Promise<boolean> { return Promise.resolve(this.exists); }
  list(_id: string, input: ListActivityRepositoryInput): Promise<ActivityEvent[]> { this.lastInput = input; return Promise.resolve(this.events); }
}
const apps = new Set<FastifyInstance>();
afterEach(async () => { await Promise.all([...apps].map((app) => app.close())); apps.clear(); });
async function setup(role: 'ADMIN' | 'OPERATOR' | 'CUSTOMER' = 'OPERATOR') {
  const repository = new MemoryRepository();
  const app = buildApp({ logger: false, serviceRequestActivityRepository: repository }); apps.add(app); await app.ready();
  return { app, repository, headers: { authorization: `Bearer ${app.jwt.sign({ sub: userId, role: role as UserRole })}` } };
}

describe('GET /service-requests/:id/activity', () => {
  it('requires authentication, allows staff and forbids other roles', async () => {
    const context = await setup('ADMIN');
    expect((await context.app.inject({ method: 'GET', url: `/service-requests/${requestId}/activity` })).statusCode).toBe(401);
    expect((await context.app.inject({ method: 'GET', url: `/service-requests/${requestId}/activity`, headers: context.headers })).statusCode).toBe(200);
    const operator = await setup('OPERATOR');
    expect((await operator.app.inject({ method: 'GET', url: `/service-requests/${requestId}/activity`, headers: operator.headers })).statusCode).toBe(200);
    const customer = await setup('CUSTOMER');
    expect((await customer.app.inject({ method: 'GET', url: `/service-requests/${requestId}/activity`, headers: customer.headers })).statusCode).toBe(403);
  });

  it('validates strict query fields, limits, enums, UUID and cursor', async () => {
    const { app, headers } = await setup();
    for (const url of [
      `/service-requests/not-uuid/activity`, `/service-requests/${requestId}/activity?extra=true`,
      `/service-requests/${requestId}/activity?limit=101`, `/service-requests/${requestId}/activity?type=INVALID`,
      `/service-requests/${requestId}/activity?category=INVALID`, `/service-requests/${requestId}/activity?cursor=invalid`,
    ]) expect((await app.inject({ method: 'GET', url, headers })).statusCode).toBe(400);
  });

  it('passes filters and returns a strict sanitized DTO', async () => {
    const { app, headers, repository } = await setup();
    const response = await app.inject({ method: 'GET', url: `/service-requests/${requestId}/activity?limit=5&type=PAYMENT_STATUS_CHANGED&category=PAYMENT&sortOrder=asc`, headers });
    expect(response.statusCode).toBe(200);
    expect(repository.lastInput).toEqual({ limit: 5, type: 'PAYMENT_STATUS_CHANGED', category: 'PAYMENT', sortOrder: 'asc' });
    expect(response.json<ActivityListResult>()).toMatchObject({ data: [{ eventType: 'PAYMENT_STATUS_CHANGED', activityType: 'PAYMENT', resource: { type: 'PAYMENT' }, details: { from: 'PENDING', to: 'PAID' } }], pagination: { hasMore: false, nextCursor: null, limit: 5 } });
    expect(response.body).not.toMatch(/metadata|amountCents|storageKey|passwordHash/);
  });

  it('returns the established 404 and exposes no write endpoints', async () => {
    const { app, headers, repository } = await setup(); repository.exists = false;
    const missing = await app.inject({ method: 'GET', url: `/service-requests/${requestId}/activity`, headers });
    expect(missing.statusCode).toBe(404); expect(missing.json<unknown>()).toMatchObject({ error: { code: 'SERVICE_REQUEST_NOT_FOUND' } });
    expect((await app.inject({ method: 'POST', url: `/service-requests/${requestId}/activity`, headers })).statusCode).toBe(404);
  });

  it('integrates every operational source without creating parallel items', async () => {
    const { app, headers, repository } = await setup();
    const types = [
      'REQUEST_CREATED', 'STATUS_CHANGED', 'COMMENT_ADDED', 'APPOINTMENT_CREATED',
      'QUOTE_CREATED', 'PAYMENT_CREATED', 'ATTACHMENT_ADDED', 'ATTACHMENT_REMOVED',
    ] as const;
    repository.events = types.map((type, index) => ({
      ...activity, id: `0000000${index + 1}-0000-4000-8000-000000000000`, type,
      metadata: type.startsWith('APPOINTMENT') ? { appointmentId: 'appointment' }
        : type.startsWith('QUOTE') ? { quoteId: 'quote' }
          : type.startsWith('PAYMENT') ? { paymentId: 'payment', quoteId: 'quote' }
            : type.startsWith('ATTACHMENT') ? { attachmentId: 'attachment', category: 'DOCUMENT' }
              : type === 'STATUS_CHANGED' ? { from: 'PENDING', to: 'CONTACTED' } : null,
    }));
    const response = await app.inject({ method: 'GET', url: `/service-requests/${requestId}/activity`, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json<ActivityListResult>().data.map((item) => item.eventType)).toEqual(types);
    expect(response.json<ActivityListResult>().data).toHaveLength(8);
  });
});

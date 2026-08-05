import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import type { ServiceRequestTimelineRepository } from './service-request-timeline.repository.js';
import type { ListTimelineInput, TimelineEvent } from './service-request-timeline.types.js';

const requestId = '11111111-1111-4111-8111-111111111111';
const userId = '33333333-3333-4333-8333-333333333333';
const baseEvent: TimelineEvent = {
  id: '22222222-2222-4222-8222-222222222222', serviceRequestId: requestId,
  type: 'COMMENT_ADDED', title: 'Comentário interno', description: 'texto', metadata: null,
  createdAt: new Date('2026-08-05T12:00:00.000Z'),
  actor: { id: userId, name: 'Equipe', email: 'equipe@example.com', role: 'OPERATOR' },
};
class MemoryRepository implements ServiceRequestTimelineRepository {
  lastList?: ListTimelineInput;
  serviceRequestExists(): Promise<boolean> { return Promise.resolve(true); }
  list(_id: string, input: ListTimelineInput): Promise<{ data: TimelineEvent[]; total: number }> { this.lastList = input; return Promise.resolve({ data: [baseEvent], total: 1 }); }
  createComment(_id: string, actor: string, content: string): Promise<TimelineEvent> { return Promise.resolve({ ...baseEvent, description: content, actor: { ...baseEvent.actor!, id: actor } }); }
}
const apps = new Set<FastifyInstance>();
afterEach(async () => { await Promise.all([...apps].map((app) => app.close())); apps.clear(); });
async function setup(role: 'ADMIN' | 'OPERATOR') {
  const repository = new MemoryRepository();
  const app = buildApp({ logger: false, serviceRequestTimelineRepository: repository }); apps.add(app); await app.ready();
  return { app, repository, headers: { authorization: `Bearer ${app.jwt.sign({ sub: userId, role })}` } };
}

describe('service request timeline routes', () => {
  it('requires authentication and allows ADMIN and OPERATOR', async () => {
    const { app } = await setup('ADMIN');
    expect((await app.inject({ method: 'GET', url: `/service-requests/${requestId}/timeline` })).statusCode).toBe(401);
    for (const role of ['ADMIN', 'OPERATOR'] as const) {
      const context = await setup(role);
      expect((await context.app.inject({ method: 'GET', url: `/service-requests/${requestId}/timeline`, headers: context.headers })).statusCode).toBe(200);
    }
  });

  it('validates and maps pagination, type and ordering', async () => {
    const { app, headers, repository } = await setup('OPERATOR');
    const response = await app.inject({ method: 'GET', url: `/service-requests/${requestId}/timeline?page=2&limit=5&type=COMMENT_ADDED&sortOrder=asc`, headers });
    expect(response.statusCode).toBe(200);
    expect(repository.lastList).toEqual({ page: 2, limit: 5, type: 'COMMENT_ADDED', sortOrder: 'asc' });
    expect(response.json()).toMatchObject({ pagination: { page: 2, limit: 5, total: 1, totalPages: 1 } });
    expect(response.body).not.toContain('passwordHash');
  });

  it('creates a trimmed internal comment and rejects extra fields', async () => {
    const { app, headers } = await setup('ADMIN');
    const created = await app.inject({ method: 'POST', url: `/service-requests/${requestId}/comments`, headers, payload: { content: '  observação  ' } });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ type: 'COMMENT_ADDED', description: 'observação', actor: { id: userId } });
    const invalid = await app.inject({ method: 'POST', url: `/service-requests/${requestId}/comments`, headers, payload: { content: 'texto', extra: true } });
    expect(invalid.statusCode).toBe(400);
  });
});

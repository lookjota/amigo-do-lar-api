import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import type { NotificationRepository } from './notifications.repository.js';
import type { ListNotificationsInput, NotificationEntity } from './notifications.types.js';

const userId = '11111111-1111-4111-8111-111111111111';
const item: NotificationEntity = { id: '22222222-2222-4222-8222-222222222222', type: 'COMMENT_ADDED', title: 'Novo comentário interno', message: 'Um comentário interno foi adicionado.', resourceType: 'SERVICE_REQUEST', resourceId: '33333333-3333-4333-8333-333333333333', metadata: null, readAt: null, createdAt: new Date('2026-08-05T12:00:00.000Z'), actor: null };
class MemoryRepository implements NotificationRepository {
  listForUser(id: string, input: ListNotificationsInput): Promise<{ data: NotificationEntity[]; total: number }> { void input; return Promise.resolve({ data: id === userId ? [item] : [], total: id === userId ? 1 : 0 }); }
  countUnread(id: string): Promise<number> { return Promise.resolve(id === userId ? 1 : 0); }
  markAsRead(id: string, notificationId: string): Promise<NotificationEntity | null> { return Promise.resolve(id === userId && notificationId === item.id ? { ...item, readAt: new Date() } : null); }
  markAllAsRead(id: string): Promise<number> { return Promise.resolve(id === userId ? 1 : 0); }
}
const apps = new Set<FastifyInstance>();
afterEach(async () => { await Promise.all([...apps].map((app) => app.close())); apps.clear(); });
async function setup(role: 'ADMIN' | 'OPERATOR') { const app = buildApp({ logger: false, notificationRepository: new MemoryRepository() }); apps.add(app); await app.ready(); return { app, headers: { authorization: `Bearer ${app.jwt.sign({ sub: userId, role })}` } }; }
describe('notification routes', () => {
  it('requires auth and allows both staff roles', async () => { const { app } = await setup('ADMIN'); expect((await app.inject({ method: 'GET', url: '/notifications' })).statusCode).toBe(401); for (const role of ['ADMIN', 'OPERATOR'] as const) { const context = await setup(role); expect((await context.app.inject({ method: 'GET', url: '/notifications', headers: context.headers })).statusCode).toBe(200); } });
  it('lists, counts, reads individually and in bulk', async () => { const { app, headers } = await setup('OPERATOR'); expect((await app.inject({ method: 'GET', url: '/notifications?unreadOnly=true&type=COMMENT_ADDED&resourceType=SERVICE_REQUEST', headers })).json()).toMatchObject({ pagination: { total: 1 } }); expect((await app.inject({ method: 'GET', url: '/notifications/unread-count', headers })).json()).toEqual({ count: 1 }); expect((await app.inject({ method: 'PATCH', url: `/notifications/${item.id}/read`, headers, payload: {} })).statusCode).toBe(200); expect((await app.inject({ method: 'PATCH', url: '/notifications/read-all', headers, payload: {} })).json()).toEqual({ updatedCount: 1 }); });
  it('rejects invalid filters, extra fields and hides foreign ids', async () => { const { app, headers } = await setup('ADMIN'); expect((await app.inject({ method: 'GET', url: '/notifications?type=INVALID', headers })).statusCode).toBe(400); expect((await app.inject({ method: 'GET', url: '/notifications?recipientUserId=x', headers })).statusCode).toBe(400); expect((await app.inject({ method: 'PATCH', url: `/notifications/${item.id}/read`, headers, payload: { extra: true } })).statusCode).toBe(400); expect((await app.inject({ method: 'PATCH', url: '/notifications/44444444-4444-4444-8444-444444444444/read', headers, payload: {} })).statusCode).toBe(404); });
});

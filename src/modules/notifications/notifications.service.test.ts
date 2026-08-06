import { describe, expect, it } from 'vitest';
import type { NotificationRepository } from './notifications.repository.js';
import { NotificationsService } from './notifications.service.js';
import type { ListNotificationsInput, NotificationEntity } from './notifications.types.js';

const notification: NotificationEntity = { id: '11111111-1111-4111-8111-111111111111', type: 'COMMENT_ADDED', title: 'Novo comentário interno', message: 'Um comentário interno foi adicionado.', resourceType: 'SERVICE_REQUEST', resourceId: '22222222-2222-4222-8222-222222222222', metadata: null, readAt: null, createdAt: new Date('2026-08-05T12:00:00.000Z'), actor: null };
class MemoryRepository implements NotificationRepository {
  items = new Map([[notification.id, notification]]);
  listForUser(userId: string, input: ListNotificationsInput): Promise<{ data: NotificationEntity[]; total: number }> { void userId; void input; return Promise.resolve({ data: [...this.items.values()], total: this.items.size }); }
  countUnread(): Promise<number> { return Promise.resolve([...this.items.values()].filter((item) => item.readAt === null).length); }
  markAsRead(_userId: string, id: string, at: Date): Promise<NotificationEntity | null> { const item = this.items.get(id); if (item === undefined) return Promise.resolve(null); const updated = item.readAt === null ? { ...item, readAt: at } : item; this.items.set(id, updated); return Promise.resolve(updated); }
  markAllAsRead(_userId: string, at: Date): Promise<number> { let count = 0; for (const [id, item] of this.items) if (item.readAt === null) { this.items.set(id, { ...item, readAt: at }); count += 1; } return Promise.resolve(count); }
}

describe('NotificationsService', () => {
  it('lists, counts and maps pagination', async () => { const service = new NotificationsService(new MemoryRepository()); expect((await service.list('user', { page: 1, limit: 20, sortOrder: 'desc' })).pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 }); expect(await service.countUnread('user')).toEqual({ count: 1 }); });
  it('marks reads idempotently and marks all', async () => { const now = new Date('2026-08-05T13:00:00.000Z'); const service = new NotificationsService(new MemoryRepository(), () => now); expect((await service.markAsRead('user', notification.id)).readAt).toEqual(now); expect((await service.markAsRead('user', notification.id)).readAt).toEqual(now); expect(await service.markAllAsRead('user')).toEqual({ updatedCount: 0 }); });
  it('hides missing or foreign notifications as not found', async () => { const service = new NotificationsService(new MemoryRepository()); await expect(service.markAsRead('other', '33333333-3333-4333-8333-333333333333')).rejects.toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' }); });
});

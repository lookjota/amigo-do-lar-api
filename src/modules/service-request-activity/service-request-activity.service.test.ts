import { describe, expect, it } from 'vitest';

import type { ServiceRequestActivityRepository } from './service-request-activity.repository.js';
import { decodeActivityCursor, ServiceRequestActivityService } from './service-request-activity.service.js';
import type { ActivityEvent, ListActivityRepositoryInput } from './service-request-activity.types.js';

const event = (id: string, metadata: ActivityEvent['metadata'] = null): ActivityEvent => ({
  id, serviceRequestId: '11111111-1111-4111-8111-111111111111', type: 'ATTACHMENT_REMOVED',
  title: 'Anexo removido', description: null, metadata, createdAt: new Date('2026-08-05T12:00:00.000Z'), actor: null,
});
class MemoryRepository implements ServiceRequestActivityRepository {
  exists = true; events: ActivityEvent[] = []; input?: ListActivityRepositoryInput;
  serviceRequestExists(): Promise<boolean> { return Promise.resolve(this.exists); }
  list(_id: string, input: ListActivityRepositoryInput): Promise<ActivityEvent[]> { this.input = input; return Promise.resolve(this.events); }
}

describe('ServiceRequestActivityService', () => {
  it('returns not found before listing', async () => {
    const repository = new MemoryRepository(); repository.exists = false;
    await expect(new ServiceRequestActivityService(repository).list(event('x').serviceRequestId, { limit: 20, sortOrder: 'desc' })).rejects.toMatchObject({ code: 'SERVICE_REQUEST_NOT_FOUND' });
    expect(repository.input).toBeUndefined();
  });

  it('creates a stable next cursor, hasMore and includes removed attachment events safely', async () => {
    const repository = new MemoryRepository();
    repository.events = [event('22222222-2222-4222-8222-222222222222', { attachmentId: 'attachment', category: 'DOCUMENT', storageKey: 'secret' }), event('33333333-3333-4333-8333-333333333333')];
    const result = await new ServiceRequestActivityService(repository).list(event('x').serviceRequestId, { limit: 1, category: 'ATTACHMENT', sortOrder: 'desc' });
    expect(result.pagination.hasMore).toBe(true);
    expect(decodeActivityCursor(result.pagination.nextCursor!)).toEqual({ createdAt: repository.events[0]!.createdAt, id: repository.events[0]!.id });
    expect(result.data[0]).toMatchObject({ eventType: 'ATTACHMENT_REMOVED', details: { attachmentId: 'attachment', category: 'DOCUMENT' } });
    expect(JSON.stringify(result)).not.toContain('storageKey');
    expect(repository.input?.category).toBe('ATTACHMENT');
  });

  it('returns an empty final page and rejects malformed cursors', async () => {
    const service = new ServiceRequestActivityService(new MemoryRepository());
    await expect(service.list(event('x').serviceRequestId, { limit: 20, cursor: 'not-a-cursor', sortOrder: 'asc' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(service.list(event('x').serviceRequestId, { limit: 20, sortOrder: 'asc' })).resolves.toEqual({ data: [], pagination: { nextCursor: null, hasMore: false, limit: 20 } });
  });
});

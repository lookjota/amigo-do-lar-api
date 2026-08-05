import { describe, expect, it } from 'vitest';

import type { ServiceRequestTimelineRepository } from './service-request-timeline.repository.js';
import { ServiceRequestTimelineService } from './service-request-timeline.service.js';
import type { ListTimelineInput, TimelineEvent } from './service-request-timeline.types.js';

const event: TimelineEvent = {
  id: '22222222-2222-4222-8222-222222222222',
  serviceRequestId: '11111111-1111-4111-8111-111111111111',
  type: 'COMMENT_ADDED', title: 'Comentário interno', description: 'texto', metadata: null,
  createdAt: new Date('2026-08-05T12:00:00.000Z'),
  actor: { id: '33333333-3333-4333-8333-333333333333', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' },
};

class MemoryRepository implements ServiceRequestTimelineRepository {
  exists = true;
  content?: string;
  serviceRequestExists(): Promise<boolean> { return Promise.resolve(this.exists); }
  list(id: string, input: ListTimelineInput): Promise<{ data: TimelineEvent[]; total: number }> { void id; void input; return Promise.resolve({ data: [event], total: 1 }); }
  createComment(_id: string, _actor: string, content: string): Promise<TimelineEvent | null> {
    this.content = content;
    return Promise.resolve(this.exists ? { ...event, description: content } : null);
  }
}

describe('ServiceRequestTimelineService', () => {
  it('normalizes comments and preserves the author', async () => {
    const repository = new MemoryRepository();
    const result = await new ServiceRequestTimelineService(repository).addComment(event.serviceRequestId, event.actor?.id ?? '', { content: '  texto interno  ' });
    expect(repository.content).toBe('texto interno');
    expect(result.actor).toEqual(event.actor);
  });

  it('rejects empty and oversized comments', async () => {
    const service = new ServiceRequestTimelineService(new MemoryRepository());
    await expect(service.addComment(event.serviceRequestId, 'actor', { content: '   ' })).rejects.toMatchObject({ code: 'TIMELINE_COMMENT_INVALID' });
    await expect(service.addComment(event.serviceRequestId, 'actor', { content: 'x'.repeat(4_001) })).rejects.toMatchObject({ code: 'TIMELINE_COMMENT_INVALID' });
  });

  it('maps missing service requests to the existing stable error', async () => {
    const repository = new MemoryRepository(); repository.exists = false;
    const service = new ServiceRequestTimelineService(repository);
    await expect(service.list(event.serviceRequestId, { page: 1, limit: 20, sortOrder: 'desc' })).rejects.toMatchObject({ code: 'SERVICE_REQUEST_NOT_FOUND' });
    await expect(service.addComment(event.serviceRequestId, 'actor', { content: 'texto' })).rejects.toMatchObject({ code: 'SERVICE_REQUEST_NOT_FOUND' });
  });
});

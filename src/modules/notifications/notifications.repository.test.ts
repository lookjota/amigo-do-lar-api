import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { createOperationalNotifications } from './notifications.repository.js';

describe('createOperationalNotifications', () => {
  it('filters active roles, excludes actor and creates explicit safe data', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'recipient' }]);
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = { user: { findMany }, notification: { createMany } } as unknown as Prisma.TransactionClient;
    expect(await createOperationalNotifications(tx, { actorUserId: 'actor', type: 'QUOTE_CREATED', message: 'Um novo orçamento foi criado.', resourceType: 'QUOTE', resourceId: '11111111-1111-4111-8111-111111111111', metadata: { quoteId: '11111111-1111-4111-8111-111111111111' }, roles: ['ADMIN'] })).toBe(1);
    expect(findMany).toHaveBeenCalledWith({ where: { isActive: true, role: { in: ['ADMIN'] }, id: { not: 'actor' } }, select: { id: true } });
    expect(createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ recipientUserId: 'recipient', actorUserId: 'actor', type: 'QUOTE_CREATED' })] });
  });
  it('does not fail or write when there are no recipients', async () => { const createMany = vi.fn(); const tx = { user: { findMany: vi.fn().mockResolvedValue([]) }, notification: { createMany } } as unknown as Prisma.TransactionClient; expect(await createOperationalNotifications(tx, { type: 'SERVICE_REQUEST_CREATED', message: 'Nova.', resourceType: 'SERVICE_REQUEST', roles: ['ADMIN', 'OPERATOR'] })).toBe(0); expect(createMany).not.toHaveBeenCalled(); });
});

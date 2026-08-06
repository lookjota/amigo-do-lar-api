import type { ServiceRequestEventType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { mapActivityEvent } from './service-request-activity.mapper.js';
import type { ActivityEvent, ActivityItemType } from './service-request-activity.types.js';

const expected: Record<ServiceRequestEventType, ActivityItemType> = {
  REQUEST_CREATED: 'REQUEST', STATUS_CHANGED: 'STATUS', COMMENT_ADDED: 'COMMENT',
  APPOINTMENT_CREATED: 'APPOINTMENT', APPOINTMENT_RESCHEDULED: 'APPOINTMENT', APPOINTMENT_STATUS_CHANGED: 'APPOINTMENT',
  QUOTE_CREATED: 'QUOTE', QUOTE_STATUS_CHANGED: 'QUOTE', PAYMENT_CREATED: 'PAYMENT',
  PAYMENT_STATUS_CHANGED: 'PAYMENT', ATTACHMENT_ADDED: 'ATTACHMENT', ATTACHMENT_REMOVED: 'ATTACHMENT',
};
const base: ActivityEvent = {
  id: '22222222-2222-4222-8222-222222222222', serviceRequestId: '11111111-1111-4111-8111-111111111111',
  type: 'REQUEST_CREATED', title: 'Solicitação criada', description: null, metadata: null,
  createdAt: new Date('2026-08-05T12:00:00.000Z'), actor: null,
};

describe('mapActivityEvent', () => {
  it.each(Object.entries(expected) as [ServiceRequestEventType, ActivityItemType][])('maps %s to %s', (type, activityType) => {
    expect(mapActivityEvent({ ...base, type }).activityType).toBe(activityType);
  });

  it('returns only allow-listed details and the correct resource', () => {
    const item = mapActivityEvent({ ...base, type: 'PAYMENT_STATUS_CHANGED', metadata: {
      paymentId: 'payment', quoteId: 'quote', from: 'PENDING', to: 'PAID',
      amountCents: 9999, reference: 'secret', storageKey: 'private', payload: { card: 'x' },
    } });
    expect(item.resource).toEqual({ type: 'PAYMENT', id: 'payment' });
    expect(item.details).toEqual({ paymentId: 'payment', quoteId: 'quote', from: 'PENDING', to: 'PAID' });
    expect(item).not.toHaveProperty('metadata');
    expect(JSON.stringify(item)).not.toMatch(/amountCents|reference|storageKey|payload/);
  });

  it('handles invalid metadata and preserves null or sanitized actors', () => {
    expect(mapActivityEvent({ ...base, type: 'ATTACHMENT_ADDED', metadata: ['invalid'] }).details).toBeNull();
    expect(mapActivityEvent(base).actor).toBeNull();
    const actor = { id: 'actor', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' as const };
    expect(mapActivityEvent({ ...base, actor }).actor).toEqual(actor);
  });
});

import { describe, expect, it } from 'vitest';

import { canTransitionServiceRequestStatus } from './service-request-status.js';

describe('service request status transitions', () => {
  it.each([
    ['PENDING', 'CONTACTED'],
    ['PENDING', 'CANCELLED'],
    ['CONTACTED', 'QUOTED'],
    ['QUOTED', 'APPROVED'],
    ['APPROVED', 'SCHEDULED'],
    ['SCHEDULED', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'COMPLETED'],
  ] as const)('allows %s -> %s', (current, next) => {
    expect(canTransitionServiceRequestStatus(current, next)).toBe(true);
  });

  it.each([
    ['PENDING', 'COMPLETED'],
    ['COMPLETED', 'PENDING'],
    ['COMPLETED', 'CANCELLED'],
    ['CANCELLED', 'PENDING'],
    ['CANCELLED', 'COMPLETED'],
    ['PENDING', 'PENDING'],
  ] as const)('rejects %s -> %s', (current, next) => {
    expect(canTransitionServiceRequestStatus(current, next)).toBe(false);
  });
});

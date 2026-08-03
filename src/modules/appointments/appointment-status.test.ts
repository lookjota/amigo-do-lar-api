import { describe, expect, it } from 'vitest';

import {
  appointmentIntervalsOverlap,
  canTransitionAppointmentStatus,
} from './appointment-status.js';

describe('appointment status transitions', () => {
  it.each([
    ['SCHEDULED', 'CONFIRMED'],
    ['SCHEDULED', 'CANCELLED'],
    ['CONFIRMED', 'IN_PROGRESS'],
    ['CONFIRMED', 'SCHEDULED'],
    ['IN_PROGRESS', 'COMPLETED'],
    ['IN_PROGRESS', 'CONFIRMED'],
  ] as const)('allows %s -> %s', (current, next) => {
    expect(canTransitionAppointmentStatus(current, next)).toBe(true);
  });

  it.each([
    ['SCHEDULED', 'COMPLETED'],
    ['COMPLETED', 'SCHEDULED'],
    ['COMPLETED', 'CANCELLED'],
    ['CANCELLED', 'SCHEDULED'],
    ['CANCELLED', 'CONFIRMED'],
    ['SCHEDULED', 'SCHEDULED'],
    ['CONFIRMED', 'CONFIRMED'],
  ] as const)('rejects %s -> %s', (current, next) => {
    expect(canTransitionAppointmentStatus(current, next)).toBe(false);
  });
});

describe('appointment interval overlap', () => {
  const base = { scheduledAt: new Date('2026-08-10T14:00:00.000Z'), durationMinutes: 120 };

  it('detects overlapping intervals', () => {
    expect(appointmentIntervalsOverlap(base, {
      scheduledAt: new Date('2026-08-10T15:00:00.000Z'), durationMinutes: 60,
    })).toBe(true);
  });

  it('allows adjacent intervals', () => {
    expect(appointmentIntervalsOverlap(base, {
      scheduledAt: new Date('2026-08-10T16:00:00.000Z'), durationMinutes: 60,
    })).toBe(false);
  });
});

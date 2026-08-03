import type { AppointmentStatus } from '@prisma/client';

const transitions: Readonly<Record<AppointmentStatus, readonly AppointmentStatus[]>> = {
  SCHEDULED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'SCHEDULED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CONFIRMED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionAppointmentStatus(
  currentStatus: AppointmentStatus,
  nextStatus: AppointmentStatus,
): boolean {
  return transitions[currentStatus].includes(nextStatus);
}

export interface AppointmentInterval {
  scheduledAt: Date;
  durationMinutes: number;
}

export function appointmentIntervalsOverlap(
  first: AppointmentInterval,
  second: AppointmentInterval,
): boolean {
  const firstEnd = first.scheduledAt.getTime() + first.durationMinutes * 60_000;
  const secondEnd = second.scheduledAt.getTime() + second.durationMinutes * 60_000;
  return first.scheduledAt.getTime() < secondEnd && second.scheduledAt.getTime() < firstEnd;
}

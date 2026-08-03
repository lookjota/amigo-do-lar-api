import type { ServiceRequestStatus } from '@prisma/client';

const transitions: Readonly<Record<ServiceRequestStatus, readonly ServiceRequestStatus[]>> = {
  PENDING: ['CONTACTED', 'CANCELLED'],
  CONTACTED: ['QUOTED', 'CANCELLED'],
  QUOTED: ['APPROVED', 'CONTACTED', 'CANCELLED'],
  APPROVED: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'APPROVED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'SCHEDULED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionServiceRequestStatus(
  currentStatus: ServiceRequestStatus,
  nextStatus: ServiceRequestStatus,
): boolean {
  return transitions[currentStatus].includes(nextStatus);
}

import type { AppointmentStatus, ServiceRequestStatus } from '@prisma/client';

export const APPOINTMENT_DEFAULT_LIMIT = 20;
export const APPOINTMENT_MAX_LIMIT = 100;
export const APPOINTMENT_MIN_DURATION_MINUTES = 15;
export const APPOINTMENT_MAX_DURATION_MINUTES = 8 * 60;
export const APPOINTMENT_NOTES_MAX_LENGTH = 4_000;

export interface CreateAppointmentInput {
  serviceRequestId: string;
  scheduledAt: string;
  durationMinutes: number;
  notes?: string | null;
}

export interface UpdateAppointmentInput {
  scheduledAt?: string;
  durationMinutes?: number;
  notes?: string | null;
}

export interface UpdateAppointmentStatusInput {
  status: AppointmentStatus;
}

export interface AppointmentCustomerSummary {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

export interface AppointmentServiceSummary {
  id: string;
  name: string;
  slug: string;
  category: string;
}

export interface AppointmentServiceRequestSummary {
  id: string;
  customerId: string;
  serviceId: string;
  description: string;
  status: ServiceRequestStatus;
  preferredDate: Date | null;
  address: string | null;
  city: string | null;
  customer: AppointmentCustomerSummary;
  service: AppointmentServiceSummary;
}

export interface AppointmentEntity {
  id: string;
  serviceRequestId: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: AppointmentStatus;
  notes: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  serviceRequest: AppointmentServiceRequestSummary;
}

export type AppointmentSortBy = 'scheduledAt' | 'createdAt' | 'updatedAt' | 'status';
export type SortOrder = 'asc' | 'desc';

export interface ListAppointmentsInput {
  page: number;
  limit: number;
  status?: AppointmentStatus;
  serviceRequestId?: string;
  customerId?: string;
  serviceId?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
  sortBy: AppointmentSortBy;
  sortOrder: SortOrder;
}

export interface ListAppointmentsFilters extends Omit<ListAppointmentsInput, 'scheduledFrom' | 'scheduledTo'> {
  scheduledFrom?: Date;
  scheduledTo?: Date;
}

export interface AppointmentListResult {
  data: AppointmentEntity[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface AppointmentScheduleData {
  scheduledAt: Date;
  durationMinutes: number;
  notes: string | null;
}

export interface UpdateAppointmentData {
  scheduledAt?: Date;
  durationMinutes?: number;
  notes?: string | null;
}

export interface UpdateAppointmentStatusData {
  status: AppointmentStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  serviceRequestStatus: ServiceRequestStatus;
}

export type CreateAppointmentResult =
  | { outcome: 'created'; appointment: AppointmentEntity }
  | { outcome: 'service_request_not_found' }
  | { outcome: 'service_request_not_approved'; status: ServiceRequestStatus }
  | { outcome: 'appointment_exists' }
  | { outcome: 'time_conflict' };

export type UpdateScheduleResult =
  | { outcome: 'updated'; appointment: AppointmentEntity }
  | { outcome: 'not_found' }
  | { outcome: 'time_conflict' };

export type UpdateStatusResult =
  | { outcome: 'updated'; appointment: AppointmentEntity }
  | { outcome: 'not_found' }
  | { outcome: 'stale'; currentStatus: AppointmentStatus };

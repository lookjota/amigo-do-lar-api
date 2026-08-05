import type { ServiceRequestStatus } from '@prisma/client';

export const SERVICE_REQUEST_DEFAULT_LIMIT = 20;
export const SERVICE_REQUEST_MAX_LIMIT = 100;
export const SERVICE_REQUEST_DESCRIPTION_MIN_LENGTH = 10;
export const SERVICE_REQUEST_DESCRIPTION_MAX_LENGTH = 2_000;
export const SERVICE_REQUEST_ADDRESS_MAX_LENGTH = 300;
export const SERVICE_REQUEST_CITY_MAX_LENGTH = 120;
export const SERVICE_REQUEST_INTERNAL_NOTES_MAX_LENGTH = 4_000;
export const SERVICE_REQUEST_DUPLICATE_WINDOW_MS = 5 * 60 * 1_000;

export interface ServiceRequestCustomerInput {
  name: string;
  phone: string;
  email?: string | null;
}

export interface CreateServiceRequestInput {
  customer: ServiceRequestCustomerInput;
  serviceId: string;
  description: string;
  preferredDate?: string | null;
  address: string;
  city: string;
}

export interface NormalizedCreateServiceRequestData {
  customer: { name: string; phone: string; email: string | null };
  serviceId: string;
  description: string;
  preferredDate: Date | null;
  address: string;
  city: string;
  duplicateSince: Date;
}

export interface ServiceRequestCustomerSummary {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isActive: boolean;
}

export interface ServiceRequestServiceSummary {
  id: string;
  name: string;
  slug: string;
  category: string;
  isActive: boolean;
}

export interface ServiceRequestEntity {
  id: string;
  customerId: string;
  serviceId: string;
  description: string;
  status: ServiceRequestStatus;
  preferredDate: Date | null;
  address: string | null;
  city: string | null;
  internalNotes: string | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer: ServiceRequestCustomerSummary;
  service: ServiceRequestServiceSummary;
}

export type ServiceRequestSortBy = 'createdAt' | 'updatedAt' | 'preferredDate' | 'status';
export type SortOrder = 'asc' | 'desc';

export interface ListServiceRequestsInput {
  page: number;
  limit: number;
  search?: string;
  status?: ServiceRequestStatus;
  customerId?: string;
  serviceId?: string;
  createdFrom?: string;
  createdTo?: string;
  preferredDateFrom?: string;
  preferredDateTo?: string;
  sortBy: ServiceRequestSortBy;
  sortOrder: SortOrder;
}

export interface ServiceRequestListFilters extends Omit<ListServiceRequestsInput, 'createdFrom' | 'createdTo' | 'preferredDateFrom' | 'preferredDateTo'> {
  createdFrom?: Date;
  createdTo?: Date;
  preferredDateFrom?: Date;
  preferredDateTo?: Date;
}

export interface ServiceRequestListResult {
  data: ServiceRequestEntity[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface UpdateServiceRequestInput {
  description?: string;
  preferredDate?: string | null;
  address?: string;
  city?: string;
  internalNotes?: string | null;
}

export interface UpdateServiceRequestData {
  description?: string;
  preferredDate?: Date | null;
  address?: string;
  city?: string;
  internalNotes?: string | null;
}

export interface UpdateServiceRequestStatusInput { status: ServiceRequestStatus }

export interface UpdateServiceRequestStatusData {
  previousStatus: ServiceRequestStatus;
  status: ServiceRequestStatus;
  completedAt: Date | null;
  cancelledAt: Date | null;
  actorUserId?: string;
}

export type CreatePublicRequestResult =
  | { outcome: 'created'; request: ServiceRequestEntity }
  | { outcome: 'service_not_found' }
  | { outcome: 'service_inactive' }
  | { outcome: 'duplicate' }
  | { outcome: 'customer_phone_conflict' }
  | { outcome: 'customer_email_conflict' };

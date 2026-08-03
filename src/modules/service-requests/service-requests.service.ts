import {
  normalizeCustomerEmail,
  normalizeCustomerName,
  normalizeCustomerPhone,
} from '../customers/customers.service.js';
import {
  CUSTOMER_NAME_MAX_LENGTH,
  CUSTOMER_NAME_MIN_LENGTH,
} from '../customers/customers.types.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
} from '../../shared/errors/http-errors.js';
import { canTransitionServiceRequestStatus } from './service-request-status.js';
import type { ServiceRequestRepository } from './service-requests.repository.js';
import {
  SERVICE_REQUEST_ADDRESS_MAX_LENGTH,
  SERVICE_REQUEST_CITY_MAX_LENGTH,
  SERVICE_REQUEST_DESCRIPTION_MAX_LENGTH,
  SERVICE_REQUEST_DESCRIPTION_MIN_LENGTH,
  SERVICE_REQUEST_DUPLICATE_WINDOW_MS,
  SERVICE_REQUEST_INTERNAL_NOTES_MAX_LENGTH,
  type CreateServiceRequestInput,
  type ListServiceRequestsInput,
  type ServiceRequestEntity,
  type ServiceRequestListResult,
  type UpdateServiceRequestInput,
  type UpdateServiceRequestStatusInput,
} from './service-requests.types.js';

const requestNotFound = () => new NotFoundError({
  code: 'SERVICE_REQUEST_NOT_FOUND', message: 'Service request not found',
});

function invalidField(field: string, message: string, code = 'INVALID_SERVICE_REQUEST_DATA'): BadRequestError {
  return new BadRequestError({ code, message: 'Service request data is invalid', details: [{ field, message }] });
}

function normalizedRequired(value: string, field: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw invalidField(field, `${field} is required and must have at most ${maxLength} characters`);
  }
  return normalized;
}

function normalizedDescription(value: string): string {
  const normalized = value.trim();
  if (normalized.length < SERVICE_REQUEST_DESCRIPTION_MIN_LENGTH || normalized.length > SERVICE_REQUEST_DESCRIPTION_MAX_LENGTH) {
    throw invalidField('description', `Description must have between ${SERVICE_REQUEST_DESCRIPTION_MIN_LENGTH} and ${SERVICE_REQUEST_DESCRIPTION_MAX_LENGTH} characters`);
  }
  return normalized;
}

function parseDate(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw invalidField(field, `${field} must be a valid ISO 8601 date`);
  return parsed;
}

export class ServiceRequestsService {
  constructor(
    private readonly repository: ServiceRequestRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(input: CreateServiceRequestInput): Promise<ServiceRequestEntity> {
    const now = this.now();
    const name = normalizeCustomerName(input.customer.name);
    if (name.length < CUSTOMER_NAME_MIN_LENGTH || name.length > CUSTOMER_NAME_MAX_LENGTH) {
      throw invalidField('customer.name', `Name must have between ${CUSTOMER_NAME_MIN_LENGTH} and ${CUSTOMER_NAME_MAX_LENGTH} characters`);
    }
    const preferredDate = input.preferredDate == null ? null : parseDate(input.preferredDate, 'preferredDate');
    if (preferredDate !== null && preferredDate.getTime() <= now.getTime()) {
      throw invalidField('preferredDate', 'Preferred date must be in the future', 'INVALID_PREFERRED_DATE');
    }

    const result = await this.repository.createPublic({
      customer: {
        name,
        phone: normalizeCustomerPhone(input.customer.phone),
        email: normalizeCustomerEmail(input.customer.email),
      },
      serviceId: input.serviceId,
      description: normalizedDescription(input.description),
      preferredDate,
      address: normalizedRequired(input.address, 'address', SERVICE_REQUEST_ADDRESS_MAX_LENGTH),
      city: normalizedRequired(input.city, 'city', SERVICE_REQUEST_CITY_MAX_LENGTH),
      duplicateSince: new Date(now.getTime() - SERVICE_REQUEST_DUPLICATE_WINDOW_MS),
    });

    if (result.outcome === 'service_not_found') throw new NotFoundError({ code: 'SERVICE_NOT_FOUND', message: 'Service not found' });
    if (result.outcome === 'service_inactive') throw new ConflictError({ code: 'SERVICE_INACTIVE', message: 'Inactive services cannot receive requests' });
    if (result.outcome === 'duplicate') throw new ConflictError({ code: 'DUPLICATE_SERVICE_REQUEST', message: 'An identical service request was submitted recently' });
    if (result.outcome === 'customer_phone_conflict') throw new ConflictError({ code: 'CUSTOMER_PHONE_ALREADY_EXISTS', message: 'A customer with this phone already exists' });
    if (result.outcome === 'customer_email_conflict') throw new ConflictError({ code: 'CUSTOMER_EMAIL_ALREADY_EXISTS', message: 'A customer with this email already exists' });
    return result.request;
  }

  async list(input: ListServiceRequestsInput): Promise<ServiceRequestListResult> {
    const { createdFrom, createdTo, preferredDateFrom, preferredDateTo, ...baseFilters } = input;
    const filters = {
      ...baseFilters,
      ...(createdFrom === undefined ? {} : { createdFrom: parseDate(createdFrom, 'createdFrom') }),
      ...(createdTo === undefined ? {} : { createdTo: parseDate(createdTo, 'createdTo') }),
      ...(preferredDateFrom === undefined ? {} : { preferredDateFrom: parseDate(preferredDateFrom, 'preferredDateFrom') }),
      ...(preferredDateTo === undefined ? {} : { preferredDateTo: parseDate(preferredDateTo, 'preferredDateTo') }),
    };
    this.validateRange(filters.createdFrom, filters.createdTo, 'createdFrom', 'createdTo');
    this.validateRange(filters.preferredDateFrom, filters.preferredDateTo, 'preferredDateFrom', 'preferredDateTo');
    const { data, total } = await this.repository.list(filters);
    return { data, pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }

  async getById(id: string): Promise<ServiceRequestEntity> {
    const request = await this.repository.findById(id);
    if (request === null) throw requestNotFound();
    return request;
  }

  async update(id: string, input: UpdateServiceRequestInput): Promise<ServiceRequestEntity> {
    if ((await this.repository.findById(id)) === null) throw requestNotFound();
    const preferredDate = input.preferredDate === undefined
      ? undefined
      : input.preferredDate === null
        ? null
        : parseDate(input.preferredDate, 'preferredDate');
    if (preferredDate instanceof Date && preferredDate.getTime() <= this.now().getTime()) {
      throw invalidField('preferredDate', 'Preferred date must be in the future', 'INVALID_PREFERRED_DATE');
    }
    const internalNotes = input.internalNotes === undefined
      ? undefined
      : input.internalNotes === null || input.internalNotes.trim() === ''
        ? null
        : input.internalNotes.trim();
    if (internalNotes !== undefined && internalNotes !== null && internalNotes.length > SERVICE_REQUEST_INTERNAL_NOTES_MAX_LENGTH) {
      throw invalidField('internalNotes', `Internal notes must have at most ${SERVICE_REQUEST_INTERNAL_NOTES_MAX_LENGTH} characters`);
    }
    return this.repository.update(id, {
      ...(input.description === undefined ? {} : { description: normalizedDescription(input.description) }),
      ...(preferredDate === undefined ? {} : { preferredDate }),
      ...(input.address === undefined ? {} : { address: normalizedRequired(input.address, 'address', SERVICE_REQUEST_ADDRESS_MAX_LENGTH) }),
      ...(input.city === undefined ? {} : { city: normalizedRequired(input.city, 'city', SERVICE_REQUEST_CITY_MAX_LENGTH) }),
      ...(internalNotes === undefined ? {} : { internalNotes }),
    });
  }

  async updateStatus(id: string, input: UpdateServiceRequestStatusInput): Promise<ServiceRequestEntity> {
    const existing = await this.repository.findById(id);
    if (existing === null) throw requestNotFound();
    if (!canTransitionServiceRequestStatus(existing.status, input.status)) {
      throw new UnprocessableEntityError({
        code: 'INVALID_SERVICE_REQUEST_STATUS_TRANSITION',
        message: `Cannot transition service request from ${existing.status} to ${input.status}`,
      });
    }
    const now = this.now();
    return this.repository.updateStatus(id, {
      status: input.status,
      completedAt: input.status === 'COMPLETED' ? now : null,
      cancelledAt: input.status === 'CANCELLED' ? now : null,
    });
  }

  private validateRange(from: Date | undefined, to: Date | undefined, fromField: string, toField: string): void {
    if (from !== undefined && to !== undefined && from > to) {
      throw invalidField(fromField, `${fromField} must be before or equal to ${toField}`);
    }
  }
}

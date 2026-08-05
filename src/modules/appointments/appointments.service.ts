import type { AppointmentStatus, ServiceRequestStatus } from '@prisma/client';

import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
} from '../../shared/errors/http-errors.js';
import { canTransitionAppointmentStatus } from './appointment-status.js';
import type { AppointmentRepository } from './appointments.repository.js';
import {
  APPOINTMENT_MAX_DURATION_MINUTES,
  APPOINTMENT_MIN_DURATION_MINUTES,
  APPOINTMENT_NOTES_MAX_LENGTH,
  type AppointmentEntity,
  type AppointmentListResult,
  type CreateAppointmentInput,
  type ListAppointmentsInput,
  type UpdateAppointmentInput,
  type UpdateAppointmentStatusInput,
} from './appointments.types.js';

const appointmentNotFound = () => new NotFoundError({
  code: 'APPOINTMENT_NOT_FOUND', message: 'Appointment not found',
});

function invalidField(field: string, message: string, code = 'INVALID_APPOINTMENT_DATA'): BadRequestError {
  return new BadRequestError({
    code,
    message: 'Appointment data is invalid',
    details: [{ field, message }],
  });
}

function parseDate(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw invalidField(field, `${field} must be a valid ISO 8601 date`, 'INVALID_APPOINTMENT_DATE');
  }
  return parsed;
}

function normalizeNotes(notes: string | null | undefined): string | null | undefined {
  if (notes === undefined) return undefined;
  if (notes === null || notes.trim() === '') return null;
  const normalized = notes.trim();
  if (normalized.length > APPOINTMENT_NOTES_MAX_LENGTH) {
    throw invalidField('notes', `Notes must have at most ${APPOINTMENT_NOTES_MAX_LENGTH} characters`);
  }
  return normalized;
}

function validateDuration(durationMinutes: number): void {
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < APPOINTMENT_MIN_DURATION_MINUTES ||
    durationMinutes > APPOINTMENT_MAX_DURATION_MINUTES
  ) {
    throw invalidField(
      'durationMinutes',
      `Duration must be an integer between ${APPOINTMENT_MIN_DURATION_MINUTES} and ${APPOINTMENT_MAX_DURATION_MINUTES} minutes`,
    );
  }
}

function serviceRequestStatusFor(status: AppointmentStatus): ServiceRequestStatus {
  if (status === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (status === 'COMPLETED') return 'COMPLETED';
  if (status === 'CANCELLED') return 'APPROVED';
  return 'SCHEDULED';
}

export class AppointmentsService {
  constructor(
    private readonly repository: AppointmentRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(input: CreateAppointmentInput, actorUserId?: string): Promise<AppointmentEntity> {
    const scheduledAt = parseDate(input.scheduledAt, 'scheduledAt');
    if (scheduledAt.getTime() <= this.now().getTime()) {
      throw invalidField('scheduledAt', 'Scheduled date must be in the future', 'INVALID_APPOINTMENT_DATE');
    }
    validateDuration(input.durationMinutes);
    const result = await this.repository.create(input.serviceRequestId, {
      scheduledAt,
      durationMinutes: input.durationMinutes,
      notes: normalizeNotes(input.notes) ?? null,
    }, actorUserId);
    if (result.outcome === 'service_request_not_found') {
      throw new NotFoundError({ code: 'SERVICE_REQUEST_NOT_FOUND', message: 'Service request not found' });
    }
    if (result.outcome === 'service_request_not_approved') {
      if (result.status === 'COMPLETED') {
        throw new ConflictError({ code: 'SERVICE_REQUEST_ALREADY_COMPLETED', message: 'Completed service requests cannot be scheduled' });
      }
      if (result.status === 'CANCELLED') {
        throw new ConflictError({ code: 'SERVICE_REQUEST_CANCELLED', message: 'Cancelled service requests cannot be scheduled' });
      }
      throw new ConflictError({ code: 'SERVICE_REQUEST_NOT_APPROVED', message: 'Service request must be approved before scheduling' });
    }
    if (result.outcome === 'appointment_exists') {
      throw new ConflictError({ code: 'APPOINTMENT_ALREADY_EXISTS', message: 'Service request already has an active appointment' });
    }
    if (result.outcome === 'time_conflict') {
      throw new ConflictError({ code: 'APPOINTMENT_TIME_CONFLICT', message: 'Appointment overlaps an existing appointment' });
    }
    return result.appointment;
  }

  async list(input: ListAppointmentsInput): Promise<AppointmentListResult> {
    const scheduledFrom = input.scheduledFrom === undefined ? undefined : parseDate(input.scheduledFrom, 'scheduledFrom');
    const scheduledTo = input.scheduledTo === undefined ? undefined : parseDate(input.scheduledTo, 'scheduledTo');
    if (scheduledFrom !== undefined && scheduledTo !== undefined && scheduledFrom > scheduledTo) {
      throw invalidField('scheduledFrom', 'scheduledFrom must be before or equal to scheduledTo');
    }
    const { data, total } = await this.repository.list({
      page: input.page,
      limit: input.limit,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.serviceRequestId === undefined ? {} : { serviceRequestId: input.serviceRequestId }),
      ...(input.customerId === undefined ? {} : { customerId: input.customerId }),
      ...(input.serviceId === undefined ? {} : { serviceId: input.serviceId }),
      ...(scheduledFrom === undefined ? {} : { scheduledFrom }),
      ...(scheduledTo === undefined ? {} : { scheduledTo }),
    });
    return {
      data,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  async getById(id: string): Promise<AppointmentEntity> {
    const appointment = await this.repository.findById(id);
    if (appointment === null) throw appointmentNotFound();
    return appointment;
  }

  async update(id: string, input: UpdateAppointmentInput, actorUserId?: string): Promise<AppointmentEntity> {
    const existing = await this.repository.findById(id);
    if (existing === null) throw appointmentNotFound();
    const changesSchedule = input.scheduledAt !== undefined || input.durationMinutes !== undefined;
    if (changesSchedule && (existing.status === 'COMPLETED' || existing.status === 'CANCELLED')) {
      throw new UnprocessableEntityError({
        code: 'INVALID_APPOINTMENT_STATUS_TRANSITION',
        message: `Cannot reschedule an appointment in ${existing.status} status`,
      });
    }
    const scheduledAt = input.scheduledAt === undefined ? undefined : parseDate(input.scheduledAt, 'scheduledAt');
    if (scheduledAt !== undefined && scheduledAt.getTime() <= this.now().getTime()) {
      throw invalidField('scheduledAt', 'Scheduled date must be in the future', 'INVALID_APPOINTMENT_DATE');
    }
    if (
      changesSchedule &&
      existing.status !== 'IN_PROGRESS' &&
      (scheduledAt ?? existing.scheduledAt).getTime() <= this.now().getTime()
    ) {
      throw invalidField('scheduledAt', 'Scheduled date must be in the future', 'INVALID_APPOINTMENT_DATE');
    }
    if (input.durationMinutes !== undefined) validateDuration(input.durationMinutes);
    const result = await this.repository.updateSchedule(id, {
      ...(scheduledAt === undefined ? {} : { scheduledAt }),
      ...(input.durationMinutes === undefined ? {} : { durationMinutes: input.durationMinutes }),
      ...(input.notes === undefined ? {} : { notes: normalizeNotes(input.notes) ?? null }),
    }, actorUserId);
    if (result.outcome === 'not_found') throw appointmentNotFound();
    if (result.outcome === 'time_conflict') {
      throw new ConflictError({ code: 'APPOINTMENT_TIME_CONFLICT', message: 'Appointment overlaps an existing appointment' });
    }
    return result.appointment;
  }

  async updateStatus(id: string, input: UpdateAppointmentStatusInput, actorUserId?: string): Promise<AppointmentEntity> {
    const existing = await this.repository.findById(id);
    if (existing === null) throw appointmentNotFound();
    if (!canTransitionAppointmentStatus(existing.status, input.status)) {
      throw this.invalidTransition(existing.status, input.status);
    }
    const now = this.now();
    const result = await this.repository.updateStatus(id, existing.status, {
      status: input.status,
      startedAt: input.status === 'IN_PROGRESS'
        ? now
        : input.status === 'COMPLETED' || input.status === 'CANCELLED'
          ? existing.startedAt
          : null,
      completedAt: input.status === 'COMPLETED' ? now : null,
      cancelledAt: input.status === 'CANCELLED' ? now : null,
      serviceRequestStatus: serviceRequestStatusFor(input.status),
    }, actorUserId);
    if (result.outcome === 'not_found') throw appointmentNotFound();
    if (result.outcome === 'stale') throw this.invalidTransition(result.currentStatus, input.status);
    return result.appointment;
  }

  private invalidTransition(current: AppointmentStatus, next: AppointmentStatus): UnprocessableEntityError {
    return new UnprocessableEntityError({
      code: 'INVALID_APPOINTMENT_STATUS_TRANSITION',
      message: `Cannot transition appointment from ${current} to ${next}`,
    });
  }
}

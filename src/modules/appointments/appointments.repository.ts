import { Prisma } from '@prisma/client';

import { database } from '../../shared/database/index.js';
import { appendTimelineEvent } from '../service-request-timeline/service-request-timeline.repository.js';
import { EVENT_TITLES } from '../service-request-timeline/service-request-timeline.types.js';
import { appointmentIntervalsOverlap } from './appointment-status.js';
import type {
  AppointmentEntity,
  AppointmentScheduleData,
  CreateAppointmentResult,
  ListAppointmentsFilters,
  UpdateAppointmentData,
  UpdateAppointmentStatusData,
  UpdateScheduleResult,
  UpdateStatusResult,
} from './appointments.types.js';

const relations = {
  serviceRequest: {
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      service: { select: { id: true, name: true, slug: true, category: true } },
    },
  },
} satisfies Prisma.AppointmentInclude;

export interface AppointmentRepository {
  create(serviceRequestId: string, input: AppointmentScheduleData, actorUserId?: string): Promise<CreateAppointmentResult>;
  list(input: ListAppointmentsFilters): Promise<{ data: AppointmentEntity[]; total: number }>;
  findById(id: string): Promise<AppointmentEntity | null>;
  updateSchedule(id: string, input: UpdateAppointmentData, actorUserId?: string): Promise<UpdateScheduleResult>;
  updateStatus(
    id: string,
    expectedStatus: AppointmentEntity['status'],
    input: UpdateAppointmentStatusData, actorUserId?: string,
  ): Promise<UpdateStatusResult>;
}

type TransactionClient = Prisma.TransactionClient;

function transactionConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

function activeAppointmentConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const target = error.meta?.target;
  return Array.isArray(target) && target.some((field) => String(field).includes('service_request'));
}

export class PrismaAppointmentRepository implements AppointmentRepository {
  async create(serviceRequestId: string, input: AppointmentScheduleData, actorUserId?: string): Promise<CreateAppointmentResult> {
    try {
      return await database.$transaction(async (transaction) => {
        const request = await transaction.serviceRequest.findUnique({
          where: { id: serviceRequestId },
          select: { status: true },
        });
        if (request === null) return { outcome: 'service_request_not_found' };
        if (request.status !== 'APPROVED') {
          return { outcome: 'service_request_not_approved', status: request.status };
        }

        const existing = await transaction.appointment.findFirst({
          where: { serviceRequestId, status: { not: 'CANCELLED' } },
          select: { id: true },
        });
        if (existing !== null) return { outcome: 'appointment_exists' };
        if (await this.hasConflict(transaction, input.scheduledAt, input.durationMinutes)) {
          return { outcome: 'time_conflict' };
        }

        const appointment = await transaction.appointment.create({
          data: { serviceRequestId, ...input },
          include: relations,
        });
        await transaction.serviceRequest.update({
          where: { id: serviceRequestId },
          data: { status: 'SCHEDULED', completedAt: null, cancelledAt: null },
        });
        appointment.serviceRequest.status = 'SCHEDULED';
        await appendTimelineEvent(transaction, {
          serviceRequestId,
          actorUserId,
          type: 'APPOINTMENT_CREATED',
          title: EVENT_TITLES.APPOINTMENT_CREATED,
          metadata: { appointmentId: appointment.id, scheduledAt: appointment.scheduledAt.toISOString() },
        });
        return { outcome: 'created', appointment };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (activeAppointmentConflict(error)) return { outcome: 'appointment_exists' };
      if (transactionConflict(error)) return { outcome: 'time_conflict' };
      throw error;
    }
  }

  async list(input: ListAppointmentsFilters): Promise<{ data: AppointmentEntity[]; total: number }> {
    const where: Prisma.AppointmentWhereInput = {
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.serviceRequestId === undefined ? {} : { serviceRequestId: input.serviceRequestId }),
      ...(input.customerId === undefined && input.serviceId === undefined
        ? {}
        : {
            serviceRequest: {
              ...(input.customerId === undefined ? {} : { customerId: input.customerId }),
              ...(input.serviceId === undefined ? {} : { serviceId: input.serviceId }),
            },
          }),
      ...(input.scheduledFrom === undefined && input.scheduledTo === undefined
        ? {}
        : {
            scheduledAt: {
              ...(input.scheduledFrom === undefined ? {} : { gte: input.scheduledFrom }),
              ...(input.scheduledTo === undefined ? {} : { lte: input.scheduledTo }),
            },
          }),
    };
    const [data, total] = await database.$transaction([
      database.appointment.findMany({
        where,
        include: relations,
        orderBy: { [input.sortBy]: input.sortOrder },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      database.appointment.count({ where }),
    ]);
    return { data, total };
  }

  async findById(id: string): Promise<AppointmentEntity | null> {
    return database.appointment.findUnique({ where: { id }, include: relations });
  }

  async updateSchedule(id: string, input: UpdateAppointmentData, actorUserId?: string): Promise<UpdateScheduleResult> {
    try {
      return await database.$transaction(async (transaction) => {
        const existing = await transaction.appointment.findUnique({ where: { id } });
        if (existing === null) return { outcome: 'not_found' };
        const scheduledAt = input.scheduledAt ?? existing.scheduledAt;
        const durationMinutes = input.durationMinutes ?? existing.durationMinutes;
        const changesInterval = input.scheduledAt !== undefined || input.durationMinutes !== undefined;
        if (changesInterval && await this.hasConflict(transaction, scheduledAt, durationMinutes, id)) {
          return { outcome: 'time_conflict' };
        }
        const appointment = await transaction.appointment.update({
          where: { id }, data: input, include: relations,
        });
        if (input.scheduledAt !== undefined && input.scheduledAt.getTime() !== existing.scheduledAt.getTime()) {
          await appendTimelineEvent(transaction, {
            serviceRequestId: existing.serviceRequestId,
            actorUserId,
            type: 'APPOINTMENT_RESCHEDULED',
            title: EVENT_TITLES.APPOINTMENT_RESCHEDULED,
            metadata: {
              appointmentId: id,
              scheduledAtFrom: existing.scheduledAt.toISOString(),
              scheduledAtTo: input.scheduledAt.toISOString(),
            },
          });
        }
        return { outcome: 'updated', appointment };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (transactionConflict(error)) return { outcome: 'time_conflict' };
      throw error;
    }
  }

  async updateStatus(
    id: string,
    expectedStatus: AppointmentEntity['status'],
    input: UpdateAppointmentStatusData,
    actorUserId?: string,
  ): Promise<UpdateStatusResult> {
    return database.$transaction(async (transaction) => {
      const result = await transaction.appointment.updateMany({
        where: { id, status: expectedStatus },
        data: {
          status: input.status,
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          cancelledAt: input.cancelledAt,
        },
      });
      if (result.count === 0) {
        const current = await transaction.appointment.findUnique({ where: { id }, select: { status: true } });
        return current === null
          ? { outcome: 'not_found' }
          : { outcome: 'stale', currentStatus: current.status };
      }
      const current = await transaction.appointment.findUniqueOrThrow({ where: { id }, select: { serviceRequestId: true } });
      await transaction.serviceRequest.update({
        where: { id: current.serviceRequestId },
        data: {
          status: input.serviceRequestStatus,
          completedAt: input.serviceRequestStatus === 'COMPLETED' ? input.completedAt : null,
          cancelledAt: null,
        },
      });
      const appointment = await transaction.appointment.findUniqueOrThrow({ where: { id }, include: relations });
      await appendTimelineEvent(transaction, {
        serviceRequestId: current.serviceRequestId,
        actorUserId,
        type: 'APPOINTMENT_STATUS_CHANGED',
        title: EVENT_TITLES.APPOINTMENT_STATUS_CHANGED,
        metadata: { appointmentId: id, from: expectedStatus, to: input.status },
      });
      return { outcome: 'updated', appointment };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async hasConflict(
    transaction: TransactionClient,
    scheduledAt: Date,
    durationMinutes: number,
    ignoredId?: string,
  ): Promise<boolean> {
    const end = new Date(scheduledAt.getTime() + durationMinutes * 60_000);
    const candidates = await transaction.appointment.findMany({
      where: {
        status: { not: 'CANCELLED' },
        scheduledAt: { lt: end },
        ...(ignoredId === undefined ? {} : { id: { not: ignoredId } }),
      },
      select: { scheduledAt: true, durationMinutes: true },
    });
    return candidates.some((candidate) => appointmentIntervalsOverlap(
      { scheduledAt, durationMinutes },
      candidate,
    ));
  }
}

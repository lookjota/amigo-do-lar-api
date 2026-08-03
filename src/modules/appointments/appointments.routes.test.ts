import type { AppointmentStatus, ServiceRequestStatus } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import type { ErrorResponse } from '../../shared/errors/error-response.js';
import { appointmentIntervalsOverlap } from './appointment-status.js';
import type { AppointmentRepository } from './appointments.repository.js';
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

const APPOINTMENT_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_REQUEST_ID = '33333333-3333-4333-8333-333333333333';
const MISSING_ID = '44444444-4444-4444-8444-444444444444';
const CUSTOMER_ID = '55555555-5555-4555-8555-555555555555';
const SECOND_CUSTOMER_ID = '66666666-6666-4666-8666-666666666666';
const SERVICE_ID = '77777777-7777-4777-8777-777777777777';
const SECOND_SERVICE_ID = '88888888-8888-4888-8888-888888888888';
const USER_ID = '99999999-9999-4999-8999-999999999999';

function entity(overrides: Partial<AppointmentEntity> = {}): AppointmentEntity {
  const createdAt = new Date('2026-08-03T12:00:00.000Z');
  return {
    id: APPOINTMENT_ID,
    serviceRequestId: REQUEST_ID,
    scheduledAt: new Date('2099-08-10T14:00:00.000Z'),
    durationMinutes: 120,
    status: 'SCHEDULED',
    notes: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt,
    updatedAt: createdAt,
    serviceRequest: {
      id: REQUEST_ID,
      customerId: CUSTOMER_ID,
      serviceId: SERVICE_ID,
      description: 'Instalação elétrica residencial.',
      status: 'SCHEDULED',
      preferredDate: null,
      address: 'Taguatinga Norte',
      city: 'Brasília',
      customer: { id: CUSTOMER_ID, name: 'João', phone: '61999999999', email: 'joao@example.com' },
      service: { id: SERVICE_ID, name: 'Elétrica', slug: 'eletrica', category: 'ELECTRICAL' },
    },
    ...overrides,
  };
}

class InMemoryAppointmentRepository implements AppointmentRepository {
  appointments: AppointmentEntity[] = [];
  requestStatuses = new Map<string, ServiceRequestStatus>([
    [REQUEST_ID, 'APPROVED'], [SECOND_REQUEST_ID, 'APPROVED'],
  ]);
  failCreate = false;

  create(serviceRequestId: string, input: AppointmentScheduleData): Promise<CreateAppointmentResult> {
    const requestStatus = this.requestStatuses.get(serviceRequestId);
    if (requestStatus === undefined) return Promise.resolve({ outcome: 'service_request_not_found' });
    if (requestStatus !== 'APPROVED') return Promise.resolve({ outcome: 'service_request_not_approved', status: requestStatus });
    if (this.appointments.some((item) => item.serviceRequestId === serviceRequestId && item.status !== 'CANCELLED')) {
      return Promise.resolve({ outcome: 'appointment_exists' });
    }
    if (this.conflicts(input.scheduledAt, input.durationMinutes)) return Promise.resolve({ outcome: 'time_conflict' });
    if (this.failCreate) return Promise.reject(new Error('transaction failed'));
    const appointment = entity({
      id: this.appointments.length === 0 ? APPOINTMENT_ID : SECOND_REQUEST_ID,
      serviceRequestId,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      notes: input.notes,
      serviceRequest: {
        ...entity().serviceRequest,
        id: serviceRequestId,
        status: 'SCHEDULED',
        customerId: serviceRequestId === SECOND_REQUEST_ID ? SECOND_CUSTOMER_ID : CUSTOMER_ID,
        serviceId: serviceRequestId === SECOND_REQUEST_ID ? SECOND_SERVICE_ID : SERVICE_ID,
      },
    });
    this.appointments.push(appointment);
    this.requestStatuses.set(serviceRequestId, 'SCHEDULED');
    return Promise.resolve({ outcome: 'created', appointment });
  }

  list(input: ListAppointmentsFilters) {
    const filtered = this.appointments
      .filter((item) => input.status === undefined || item.status === input.status)
      .filter((item) => input.serviceRequestId === undefined || item.serviceRequestId === input.serviceRequestId)
      .filter((item) => input.customerId === undefined || item.serviceRequest.customerId === input.customerId)
      .filter((item) => input.serviceId === undefined || item.serviceRequest.serviceId === input.serviceId)
      .filter((item) => input.scheduledFrom === undefined || item.scheduledAt >= input.scheduledFrom)
      .filter((item) => input.scheduledTo === undefined || item.scheduledAt <= input.scheduledTo);
    const start = (input.page - 1) * input.limit;
    return Promise.resolve({ data: filtered.slice(start, start + input.limit), total: filtered.length });
  }

  findById(id: string) {
    return Promise.resolve(this.appointments.find((item) => item.id === id) ?? null);
  }

  updateSchedule(id: string, input: UpdateAppointmentData): Promise<UpdateScheduleResult> {
    const current = this.appointments.find((item) => item.id === id);
    if (current === undefined) return Promise.resolve({ outcome: 'not_found' });
    const scheduledAt = input.scheduledAt ?? current.scheduledAt;
    const durationMinutes = input.durationMinutes ?? current.durationMinutes;
    if (this.conflicts(scheduledAt, durationMinutes, id)) return Promise.resolve({ outcome: 'time_conflict' });
    Object.assign(current, input);
    return Promise.resolve({ outcome: 'updated', appointment: current });
  }

  updateStatus(id: string, expectedStatus: AppointmentStatus, input: UpdateAppointmentStatusData): Promise<UpdateStatusResult> {
    const current = this.appointments.find((item) => item.id === id);
    if (current === undefined) return Promise.resolve({ outcome: 'not_found' });
    if (current.status !== expectedStatus) return Promise.resolve({ outcome: 'stale', currentStatus: current.status });
    Object.assign(current, {
      status: input.status,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      cancelledAt: input.cancelledAt,
    });
    current.serviceRequest.status = input.serviceRequestStatus;
    this.requestStatuses.set(current.serviceRequestId, input.serviceRequestStatus);
    return Promise.resolve({ outcome: 'updated', appointment: current });
  }

  private conflicts(scheduledAt: Date, durationMinutes: number, ignoredId?: string): boolean {
    return this.appointments.some((item) =>
      item.id !== ignoredId && item.status !== 'CANCELLED' && appointmentIntervalsOverlap(
        { scheduledAt, durationMinutes }, item,
      ));
  }
}

const apps = new Set<FastifyInstance>();
let repository: InMemoryAppointmentRepository;

function createApp(): FastifyInstance {
  const app = buildApp({ logger: false, appointmentRepository: repository });
  apps.add(app);
  return app;
}

async function auth(role: 'ADMIN' | 'OPERATOR') {
  const app = createApp();
  await app.ready();
  return { authorization: `Bearer ${app.jwt.sign({ sub: USER_ID, role })}` };
}

function validPayload(serviceRequestId = REQUEST_ID) {
  return {
    serviceRequestId,
    scheduledAt: '2099-08-10T14:00:00.000Z',
    durationMinutes: 120,
    notes: ' Levar ferramentas. ',
  };
}

beforeEach(() => { repository = new InMemoryAppointmentRepository(); });
afterEach(async () => { await Promise.all([...apps].map(async (app) => app.close())); apps.clear(); });

describe('appointment creation', () => {
  it('requires authentication', async () => {
    const response = await createApp().inject({ method: 'POST', url: '/appointments', payload: validPayload() });
    expect(response.statusCode).toBe(401);
  });

  it.each(['ADMIN', 'OPERATOR'] as const)('allows %s, creates and synchronizes the request', async (role) => {
    const response = await createApp().inject({ method: 'POST', url: '/appointments', headers: await auth(role), payload: validPayload() });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ status: 'SCHEDULED', notes: 'Levar ferramentas.', serviceRequest: { status: 'SCHEDULED' } });
    expect(repository.requestStatuses.get(REQUEST_ID)).toBe('SCHEDULED');
    expect(response.body).not.toContain('internalNotes');
  });

  it('returns stable errors for missing, unapproved, completed and cancelled requests', async () => {
    const headers = await auth('ADMIN');
    const missing = await createApp().inject({ method: 'POST', url: '/appointments', headers, payload: validPayload(MISSING_ID) });
    repository.requestStatuses.set(REQUEST_ID, 'PENDING');
    const pending = await createApp().inject({ method: 'POST', url: '/appointments', headers, payload: validPayload() });
    repository.requestStatuses.set(REQUEST_ID, 'COMPLETED');
    const completed = await createApp().inject({ method: 'POST', url: '/appointments', headers, payload: validPayload() });
    repository.requestStatuses.set(REQUEST_ID, 'CANCELLED');
    const cancelled = await createApp().inject({ method: 'POST', url: '/appointments', headers, payload: validPayload() });
    expect([missing, pending, completed, cancelled].map((item) => item.statusCode)).toEqual([404, 409, 409, 409]);
    expect([missing, pending, completed, cancelled].map((item) => item.json<ErrorResponse>().error.code)).toEqual([
      'SERVICE_REQUEST_NOT_FOUND', 'SERVICE_REQUEST_NOT_APPROVED', 'SERVICE_REQUEST_ALREADY_COMPLETED', 'SERVICE_REQUEST_CANCELLED',
    ]);
  });

  it('rejects an already scheduled request, past dates and time conflicts', async () => {
    const headers = await auth('OPERATOR');
    await createApp().inject({ method: 'POST', url: '/appointments', headers, payload: validPayload() });
    repository.requestStatuses.set(REQUEST_ID, 'APPROVED');
    const duplicate = await createApp().inject({ method: 'POST', url: '/appointments', headers, payload: validPayload() });
    const past = await createApp().inject({ method: 'POST', url: '/appointments', headers, payload: { ...validPayload(SECOND_REQUEST_ID), scheduledAt: '2020-01-01T00:00:00.000Z' } });
    const conflict = await createApp().inject({ method: 'POST', url: '/appointments', headers, payload: { ...validPayload(SECOND_REQUEST_ID), scheduledAt: '2099-08-10T15:00:00.000Z' } });
    expect(duplicate.json<ErrorResponse>().error.code).toBe('APPOINTMENT_ALREADY_EXISTS');
    expect(past.json<ErrorResponse>().error.code).toBe('INVALID_APPOINTMENT_DATE');
    expect(conflict.json<ErrorResponse>().error.code).toBe('APPOINTMENT_TIME_CONFLICT');
  });

  it('does not mutate either resource when creation fails', async () => {
    repository.failCreate = true;
    const response = await createApp().inject({ method: 'POST', url: '/appointments', headers: await auth('ADMIN'), payload: validPayload() });
    expect(response.statusCode).toBe(500);
    expect(repository.appointments).toHaveLength(0);
    expect(repository.requestStatuses.get(REQUEST_ID)).toBe('APPROVED');
  });
});

describe('appointment queries and updates', () => {
  beforeEach(() => {
    repository.appointments.push(
      entity(),
      entity({
        id: SECOND_REQUEST_ID, serviceRequestId: SECOND_REQUEST_ID, status: 'CONFIRMED',
        scheduledAt: new Date('2099-09-10T14:00:00.000Z'),
        serviceRequest: { ...entity().serviceRequest, id: SECOND_REQUEST_ID, customerId: SECOND_CUSTOMER_ID, serviceId: SECOND_SERVICE_ID },
      }),
    );
  });

  it('requires auth, applies bounded pagination, status, period, customer and service filters', async () => {
    expect((await createApp().inject('/appointments')).statusCode).toBe(401);
    const headers = await auth('ADMIN');
    const pagination = await createApp().inject({ url: '/appointments?page=2&limit=1', headers });
    const status = await createApp().inject({ url: '/appointments?status=CONFIRMED', headers });
    const period = await createApp().inject({ url: '/appointments?scheduledFrom=2099-08-01T00%3A00%3A00.000Z&scheduledTo=2099-08-31T23%3A59%3A59.000Z', headers });
    const customer = await createApp().inject({ url: `/appointments?customerId=${CUSTOMER_ID}`, headers });
    const service = await createApp().inject({ url: `/appointments?serviceId=${SECOND_SERVICE_ID}`, headers });
    expect(pagination.json()).toMatchObject({ pagination: { page: 2, limit: 1, total: 2, totalPages: 2 } });
    expect(status.json<{ data: unknown[] }>().data).toHaveLength(1);
    expect(period.json<{ data: unknown[] }>().data).toHaveLength(1);
    expect(customer.json<{ data: unknown[] }>().data).toHaveLength(1);
    expect(service.json<{ data: unknown[] }>().data).toHaveLength(1);
  });

  it('gets relationships by id and returns 404 for missing appointments', async () => {
    const headers = await auth('OPERATOR');
    const found = await createApp().inject({ url: `/appointments/${APPOINTMENT_ID}`, headers });
    const missing = await createApp().inject({ url: `/appointments/${MISSING_ID}`, headers });
    expect(found.json()).toMatchObject({ serviceRequest: { customer: { id: CUSTOMER_ID }, service: { id: SERVICE_ID } } });
    expect(missing.statusCode).toBe(404);
    expect(missing.json<ErrorResponse>().error.code).toBe('APPOINTMENT_NOT_FOUND');
  });

  it('reschedules, rejects conflicts and rejects direct status updates', async () => {
    const headers = await auth('ADMIN');
    const updated = await createApp().inject({ method: 'PATCH', url: `/appointments/${APPOINTMENT_ID}`, headers, payload: { scheduledAt: '2099-08-11T14:00:00.000Z', durationMinutes: 90 } });
    const conflict = await createApp().inject({ method: 'PATCH', url: `/appointments/${APPOINTMENT_ID}`, headers, payload: { scheduledAt: '2099-09-10T14:30:00.000Z' } });
    const directStatus = await createApp().inject({ method: 'PATCH', url: `/appointments/${APPOINTMENT_ID}`, headers, payload: { status: 'COMPLETED' } });
    expect(updated.json()).toMatchObject({ scheduledAt: '2099-08-11T14:00:00.000Z', durationMinutes: 90 });
    expect(conflict.json<ErrorResponse>().error.code).toBe('APPOINTMENT_TIME_CONFLICT');
    expect(directStatus.statusCode).toBe(400);
  });
});

describe('appointment status updates', () => {
  beforeEach(() => { repository.appointments.push(entity()); });

  it('applies valid transitions and rejects invalid transitions', async () => {
    const headers = await auth('ADMIN');
    const confirmed = await createApp().inject({ method: 'PATCH', url: `/appointments/${APPOINTMENT_ID}/status`, headers, payload: { status: 'CONFIRMED' } });
    expect(confirmed.json()).toMatchObject({ status: 'CONFIRMED' });
    const invalid = await createApp().inject({ method: 'PATCH', url: `/appointments/${APPOINTMENT_ID}/status`, headers, payload: { status: 'COMPLETED' } });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json<ErrorResponse>().error.code).toBe('INVALID_APPOINTMENT_STATUS_TRANSITION');
  });

  it('synchronizes IN_PROGRESS and COMPLETED with their timestamps', async () => {
    const headers = await auth('OPERATOR');
    repository.appointments[0] = entity({ status: 'CONFIRMED' });
    const started = await createApp().inject({ method: 'PATCH', url: `/appointments/${APPOINTMENT_ID}/status`, headers, payload: { status: 'IN_PROGRESS' } });
    expect(started.json<{ startedAt: string | null; serviceRequest: { status: string } }>()).toMatchObject({ serviceRequest: { status: 'IN_PROGRESS' } });
    expect(started.json<{ startedAt: string | null }>().startedAt).not.toBeNull();
    const completed = await createApp().inject({ method: 'PATCH', url: `/appointments/${APPOINTMENT_ID}/status`, headers, payload: { status: 'COMPLETED' } });
    expect(completed.json<{ completedAt: string | null; serviceRequest: { status: string } }>()).toMatchObject({ serviceRequest: { status: 'COMPLETED' } });
    expect(completed.json<{ completedAt: string | null }>().completedAt).not.toBeNull();
  });

  it('cancels, returns the request to APPROVED and permits a replacement appointment', async () => {
    const headers = await auth('ADMIN');
    const cancelled = await createApp().inject({ method: 'PATCH', url: `/appointments/${APPOINTMENT_ID}/status`, headers, payload: { status: 'CANCELLED' } });
    expect(cancelled.json()).toMatchObject({ status: 'CANCELLED', serviceRequest: { status: 'APPROVED' } });
    expect(cancelled.json<{ cancelledAt: string | null }>().cancelledAt).not.toBeNull();
    const replacement = await createApp().inject({ method: 'POST', url: '/appointments', headers, payload: validPayload() });
    expect(replacement.statusCode).toBe(201);
    expect(repository.appointments).toHaveLength(2);
  });
});

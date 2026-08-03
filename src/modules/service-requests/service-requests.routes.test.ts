import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import type { ErrorResponse } from '../../shared/errors/error-response.js';
import type { ServiceRequestRepository } from './service-requests.repository.js';
import type {
  CreatePublicRequestResult,
  NormalizedCreateServiceRequestData,
  ServiceRequestEntity,
  ServiceRequestListFilters,
  UpdateServiceRequestData,
  UpdateServiceRequestStatusData,
} from './service-requests.types.js';

const REQUEST_ID = '1ad575e6-0225-45ce-bb18-296407bc558b';
const CUSTOMER_ID = '23ed23cf-22d0-414d-bbea-06b8b57b9703';
const SERVICE_ID = 'aa9a8c21-32fb-47ba-aef3-03ef668d727b';
const INACTIVE_SERVICE_ID = 'eadb62b5-6da8-4a7c-a135-c86bd4edff38';
const MISSING_ID = '91e17601-b2dd-43dd-8f02-071652606aaa';
const USER_ID = 'b32efc7d-bb72-4d0b-a64b-b34f4fc83bad';
const createdAt = new Date('2026-08-03T12:00:00.000Z');

function entity(overrides: Partial<ServiceRequestEntity> = {}): ServiceRequestEntity {
  return {
    id: REQUEST_ID, customerId: CUSTOMER_ID, serviceId: SERVICE_ID,
    description: 'A tomada da cozinha parou de funcionar.', status: 'PENDING',
    preferredDate: new Date('2099-08-10T14:00:00.000Z'), address: 'Taguatinga Norte', city: 'Brasília',
    internalNotes: null, completedAt: null, cancelledAt: null, createdAt, updatedAt: createdAt,
    customer: { id: CUSTOMER_ID, name: 'João da Silva', phone: '61999999999', email: 'joao@example.com', isActive: true },
    service: { id: SERVICE_ID, name: 'Elétrica', slug: 'eletrica', category: 'ELECTRICAL', isActive: true },
    ...overrides,
  };
}

class InMemoryServiceRequestRepository implements ServiceRequestRepository {
  readonly requests: ServiceRequestEntity[] = [entity()];
  readonly customers = new Map([['61999999999', CUSTOMER_ID]]);
  lastCreate?: NormalizedCreateServiceRequestData;
  nextOutcome?: CreatePublicRequestResult;

  createPublic(input: NormalizedCreateServiceRequestData): Promise<CreatePublicRequestResult> {
    this.lastCreate = input;
    if (this.nextOutcome !== undefined) return Promise.resolve(this.nextOutcome);
    if (input.serviceId === MISSING_ID) return Promise.resolve({ outcome: 'service_not_found' });
    if (input.serviceId === INACTIVE_SERVICE_ID) return Promise.resolve({ outcome: 'service_inactive' });
    const customerId = this.customers.get(input.customer.phone) ?? '7aac8aa7-ce44-4f20-8a85-b3e40da1ca33';
    this.customers.set(input.customer.phone, customerId);
    const request = entity({
      id: `10000000-0000-4000-8000-${String(this.requests.length + 1).padStart(12, '0')}`,
      customerId, serviceId: input.serviceId, description: input.description,
      preferredDate: input.preferredDate, address: input.address, city: input.city,
      customer: { id: customerId, name: input.customer.name, phone: input.customer.phone, email: input.customer.email, isActive: true },
    });
    this.requests.push(request);
    return Promise.resolve({ outcome: 'created', request });
  }

  list(input: ServiceRequestListFilters) {
    const filtered = this.requests
      .filter((item) => input.status === undefined || item.status === input.status)
      .filter((item) => input.customerId === undefined || item.customerId === input.customerId)
      .filter((item) => input.serviceId === undefined || item.serviceId === input.serviceId)
      .filter((item) => input.createdFrom === undefined || item.createdAt >= input.createdFrom)
      .filter((item) => input.createdTo === undefined || item.createdAt <= input.createdTo);
    const start = (input.page - 1) * input.limit;
    return Promise.resolve({ data: filtered.slice(start, start + input.limit), total: filtered.length });
  }

  findById(id: string) { return Promise.resolve(this.requests.find((item) => item.id === id) ?? null); }

  update(id: string, input: UpdateServiceRequestData) {
    return Promise.resolve(this.replace(id, input));
  }

  updateStatus(id: string, input: UpdateServiceRequestStatusData) {
    return Promise.resolve(this.replace(id, input));
  }

  private replace(id: string, input: UpdateServiceRequestData | UpdateServiceRequestStatusData): ServiceRequestEntity {
    const index = this.requests.findIndex((item) => item.id === id);
    const current = this.requests[index];
    if (current === undefined) throw new Error('missing request');
    const updated = { ...current, ...input, updatedAt: new Date() };
    this.requests[index] = updated;
    return updated;
  }
}

const apps = new Set<FastifyInstance>();
let repository: InMemoryServiceRequestRepository;

function createApp(): FastifyInstance {
  const app = buildApp({ logger: false, serviceRequestRepository: repository });
  apps.add(app);
  return app;
}

async function auth(role: 'ADMIN' | 'OPERATOR'): Promise<{ authorization: string }> {
  const app = createApp();
  await app.ready();
  return { authorization: `Bearer ${app.jwt.sign({ sub: USER_ID, role })}` };
}

function validPayload(serviceId = SERVICE_ID) {
  return {
    customer: { name: '  João   da Silva ', phone: '(61) 99999-9999', email: ' JOAO@Example.com ' },
    serviceId, description: '  A tomada da cozinha parou de funcionar.  ',
    preferredDate: '2099-08-10T14:00:00.000Z', address: '  Taguatinga   Norte ', city: ' Brasília ',
  };
}

beforeEach(() => { repository = new InMemoryServiceRequestRepository(); });
afterEach(async () => { await Promise.all([...apps].map((app) => app.close())); apps.clear(); });

describe('public service request creation', () => {
  it('creates without authentication, normalizes the customer and hides internal fields', async () => {
    const response = await createApp().inject({ method: 'POST', url: '/service-requests', payload: validPayload() });
    expect(response.statusCode).toBe(201);
    expect(repository.lastCreate?.customer).toEqual({ name: 'João da Silva', phone: '61999999999', email: 'joao@example.com' });
    expect(response.json()).toMatchObject({ status: 'PENDING', address: 'Taguatinga Norte', city: 'Brasília' });
    expect(response.body).not.toContain('internalNotes');
    expect(response.body).not.toContain('customer":');
  });

  it('reuses an existing customer and creates a missing customer', async () => {
    const existing = await createApp().inject({ method: 'POST', url: '/service-requests', payload: validPayload() });
    const freshPayload = validPayload();
    freshPayload.customer.phone = '(61) 98888-7777';
    const fresh = await createApp().inject({ method: 'POST', url: '/service-requests', payload: freshPayload });
    expect(existing.json()).toMatchObject({ customerId: CUSTOMER_ID });
    expect(fresh.json()).not.toMatchObject({ customerId: CUSTOMER_ID });
    expect(repository.customers.size).toBe(2);
  });

  it.each([
    [MISSING_ID, 404, 'SERVICE_NOT_FOUND'],
    [INACTIVE_SERVICE_ID, 409, 'SERVICE_INACTIVE'],
  ])('rejects unavailable service %s', async (serviceId, status, code) => {
    const response = await createApp().inject({ method: 'POST', url: '/service-requests', payload: validPayload(serviceId) });
    expect(response.statusCode).toBe(status);
    expect(response.json<ErrorResponse>().error.code).toBe(code);
  });

  it('rejects an identical recent submission with a stable conflict', async () => {
    repository.nextOutcome = { outcome: 'duplicate' };
    const response = await createApp().inject({ method: 'POST', url: '/service-requests', payload: validPayload() });
    expect(response.statusCode).toBe(409);
    expect(response.json<ErrorResponse>().error.code).toBe('DUPLICATE_SERVICE_REQUEST');
  });

  it('rejects invalid description, date and forbidden fields', async () => {
    const app = createApp();
    const invalidDescription = await app.inject({ method: 'POST', url: '/service-requests', payload: { ...validPayload(), description: 'curta' } });
    const invalidDate = await app.inject({ method: 'POST', url: '/service-requests', payload: { ...validPayload(), preferredDate: 'not-a-date' } });
    const pastDate = await app.inject({ method: 'POST', url: '/service-requests', payload: { ...validPayload(), preferredDate: '2020-01-01T00:00:00.000Z' } });
    const status = await app.inject({ method: 'POST', url: '/service-requests', payload: { ...validPayload(), status: 'COMPLETED' } });
    const notes = await app.inject({ method: 'POST', url: '/service-requests', payload: { ...validPayload(), internalNotes: 'private' } });
    expect([invalidDescription, invalidDate, pastDate, status, notes].map((item) => item.statusCode)).toEqual([400, 400, 400, 400, 400]);
    expect(pastDate.json<ErrorResponse>().error.code).toBe('INVALID_PREFERRED_DATE');
  });
});

describe('administrative service request operations', () => {
  it('requires JWT and allows ADMIN and OPERATOR to list', async () => {
    expect((await createApp().inject('/service-requests')).statusCode).toBe(401);
    for (const role of ['ADMIN', 'OPERATOR'] as const) {
      const response = await createApp().inject({ url: '/service-requests', headers: await auth(role) });
      expect(response.statusCode).toBe(200);
    }
  });

  it('supports pagination and status, customer, service and period filters', async () => {
    repository.requests.push(entity({ id: MISSING_ID, status: 'CONTACTED', customerId: MISSING_ID, createdAt: new Date('2026-07-01T00:00:00.000Z') }));
    const headers = await auth('ADMIN');
    const pagination = await createApp().inject({ url: '/service-requests?page=2&limit=1', headers });
    const status = await createApp().inject({ url: '/service-requests?status=CONTACTED', headers });
    const customer = await createApp().inject({ url: `/service-requests?customerId=${CUSTOMER_ID}`, headers });
    const service = await createApp().inject({ url: `/service-requests?serviceId=${SERVICE_ID}`, headers });
    const period = await createApp().inject({ url: '/service-requests?createdFrom=2026-08-01T00%3A00%3A00.000Z&createdTo=2026-08-04T00%3A00%3A00.000Z', headers });
    expect(pagination.json()).toMatchObject({ pagination: { page: 2, limit: 1, total: 2, totalPages: 2 } });
    expect(status.json()).toMatchObject({ data: [{ status: 'CONTACTED' }] });
    expect(customer.json<{ data: unknown[] }>().data).toHaveLength(1);
    expect(service.json<{ data: unknown[] }>().data).toHaveLength(2);
    expect(period.json<{ data: unknown[] }>().data).toHaveLength(1);
  });

  it('gets by id and returns a stable 404', async () => {
    const headers = await auth('OPERATOR');
    expect((await createApp().inject({ url: `/service-requests/${REQUEST_ID}`, headers })).statusCode).toBe(200);
    const missing = await createApp().inject({ url: `/service-requests/${MISSING_ID}`, headers });
    expect(missing.statusCode).toBe(404);
    expect(missing.json<ErrorResponse>().error.code).toBe('SERVICE_REQUEST_NOT_FOUND');
  });

  it('updates only operational fields and rejects direct status changes', async () => {
    const headers = await auth('OPERATOR');
    const updated = await createApp().inject({ method: 'PATCH', url: `/service-requests/${REQUEST_ID}`, headers, payload: { description: 'Descrição operacional atualizada.', internalNotes: 'Ligar pela manhã.' } });
    const status = await createApp().inject({ method: 'PATCH', url: `/service-requests/${REQUEST_ID}`, headers, payload: { status: 'CONTACTED' } });
    expect(updated.json()).toMatchObject({ description: 'Descrição operacional atualizada.', internalNotes: 'Ligar pela manhã.' });
    expect(status.statusCode).toBe(400);
  });

  it('applies valid transitions, terminal timestamps and rejects invalid transitions', async () => {
    const headers = await auth('ADMIN');
    const contacted = await createApp().inject({ method: 'PATCH', url: `/service-requests/${REQUEST_ID}/status`, headers, payload: { status: 'CONTACTED' } });
    expect(contacted.json()).toMatchObject({ status: 'CONTACTED' });
    repository.requests[0] = entity({ status: 'IN_PROGRESS' });
    const completed = await createApp().inject({ method: 'PATCH', url: `/service-requests/${REQUEST_ID}/status`, headers, payload: { status: 'COMPLETED' } });
    expect(completed.json<{ completedAt: string | null }>().completedAt).not.toBeNull();
    repository.requests[0] = entity();
    const cancelled = await createApp().inject({ method: 'PATCH', url: `/service-requests/${REQUEST_ID}/status`, headers, payload: { status: 'CANCELLED' } });
    expect(cancelled.json<{ cancelledAt: string | null }>().cancelledAt).not.toBeNull();
    repository.requests[0] = entity();
    const invalid = await createApp().inject({ method: 'PATCH', url: `/service-requests/${REQUEST_ID}/status`, headers, payload: { status: 'COMPLETED' } });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json<ErrorResponse>().error.code).toBe('INVALID_SERVICE_REQUEST_STATUS_TRANSITION');
  });
});

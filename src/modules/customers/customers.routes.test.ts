import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import type { ErrorResponse } from '../../shared/errors/error-response.js';
import type { CustomerRepository } from './customers.repository.js';
import type {
  CreateCustomerData,
  CustomerEntity,
  ListCustomersInput,
  UpdateCustomerData,
} from './customers.types.js';

const CUSTOMER_ID = '1ad575e6-0225-45ce-bb18-296407bc558b';
const INACTIVE_ID = '23ed23cf-22d0-414d-bbea-06b8b57b9703';
const SECOND_ID = 'aa9a8c21-32fb-47ba-aef3-03ef668d727b';
const MISSING_ID = 'eadb62b5-6da8-4a7c-a135-c86bd4edff38';
const USER_ID = 'b32efc7d-bb72-4d0b-a64b-b34f4fc83bad';
const now = new Date('2026-08-02T12:00:00.000Z');
type TestRole = 'ADMIN' | 'OPERATOR';

const initialCustomers: CustomerEntity[] = [
  {
    id: CUSTOMER_ID,
    name: 'João da Silva',
    phone: '61999999999',
    email: 'joao@example.com',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: INACTIVE_ID,
    name: 'Maria Inativa',
    phone: '6133334444',
    email: null,
    isActive: false,
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    updatedAt: now,
  },
  {
    id: SECOND_ID,
    name: 'Ana Souza',
    phone: '61988887777',
    email: 'ana@example.com',
    isActive: true,
    createdAt: new Date('2026-07-31T12:00:00.000Z'),
    updatedAt: now,
  },
];

class InMemoryCustomerRepository implements CustomerRepository {
  readonly customers: CustomerEntity[];

  constructor(customers: CustomerEntity[]) {
    this.customers = customers.map((customer) => ({ ...customer }));
  }

  list(input: ListCustomersInput) {
    const search = input.search?.toLowerCase();
    const filtered = this.customers
      .filter(
        (customer) =>
          input.isActive === undefined || customer.isActive === input.isActive,
      )
      .filter(
        (customer) =>
          search === undefined ||
          customer.name.toLowerCase().includes(search) ||
          customer.phone.includes(search) ||
          customer.email?.toLowerCase().includes(search) === true,
      )
      .sort((left, right) => {
        const leftValue = left[input.sortBy];
        const rightValue = right[input.sortBy];
        const comparison =
          typeof leftValue === 'string'
            ? leftValue.localeCompare(rightValue as string)
            : leftValue.getTime() - (rightValue as Date).getTime();
        return input.sortOrder === 'asc' ? comparison : -comparison;
      });
    const start = (input.page - 1) * input.limit;
    return Promise.resolve({
      data: filtered.slice(start, start + input.limit),
      total: filtered.length,
    });
  }

  findById(id: string) {
    return Promise.resolve(
      this.customers.find((customer) => customer.id === id) ?? null,
    );
  }

  findByPhone(phone: string) {
    return Promise.resolve(
      this.customers.find((customer) => customer.phone === phone) ?? null,
    );
  }

  findByEmail(email: string) {
    return Promise.resolve(
      this.customers.find((customer) => customer.email === email) ?? null,
    );
  }

  create(input: CreateCustomerData) {
    const customer: CustomerEntity = {
      ...input,
      id: '91e17601-b2dd-43dd-8f02-071652606aaa',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.customers.push(customer);
    return Promise.resolve(customer);
  }

  update(id: string, input: UpdateCustomerData) {
    const index = this.customers.findIndex((customer) => customer.id === id);
    const current = this.customers[index];
    if (index < 0 || current === undefined) {
      return Promise.reject(new Error('Customer not found'));
    }
    const updated = { ...current, ...input, updatedAt: now };
    this.customers[index] = updated;
    return Promise.resolve(updated);
  }
}

const apps = new Set<FastifyInstance>();
let repository: InMemoryCustomerRepository;

function createApp(): FastifyInstance {
  const app = buildApp({ logger: false, customerRepository: repository });
  apps.add(app);
  return app;
}

async function authorization(role: TestRole): Promise<string> {
  const app = createApp();
  await app.ready();
  return `Bearer ${app.jwt.sign({ sub: USER_ID, role })}`;
}

function validPayload() {
  return {
    name: '  Carlos   Lima  ',
    phone: '(61) 97777-6666',
    email: ' CARLOS@Example.com ',
  };
}

beforeEach(() => {
  repository = new InMemoryCustomerRepository(initialCustomers);
});

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

describe('customer queries', () => {
  it('requires authentication for listing', async () => {
    expect((await createApp().inject('/customers')).statusCode).toBe(401);
  });

  it('applies pagination, search, active filter and sorting', async () => {
    const headers = { authorization: await authorization('OPERATOR') };
    const pagination = await createApp().inject({
      method: 'GET',
      url: '/customers?page=2&limit=1&sortBy=name&sortOrder=asc',
      headers,
    });
    const search = await createApp().inject({
      method: 'GET',
      url: '/customers?search=JOAO',
      headers,
    });
    const inactive = await createApp().inject({
      method: 'GET',
      url: '/customers?isActive=false',
      headers,
    });

    expect(pagination.json()).toMatchObject({
      data: [{ id: CUSTOMER_ID }],
      pagination: { page: 2, limit: 1, total: 3, totalPages: 3 },
    });
    expect(search.json()).toMatchObject({ data: [{ id: CUSTOMER_ID }] });
    expect(inactive.json()).toMatchObject({ data: [{ id: INACTIVE_ID }] });
  });

  it('rejects limits above the mandatory maximum', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/customers?limit=101',
      headers: { authorization: await authorization('ADMIN') },
    });
    expect(response.statusCode).toBe(400);
  });

  it('gets active or inactive customers by id without unexpected fields', async () => {
    const headers = { authorization: await authorization('OPERATOR') };
    const active = await createApp().inject({
      method: 'GET',
      url: `/customers/${CUSTOMER_ID}`,
      headers,
    });
    const inactive = await createApp().inject({
      method: 'GET',
      url: `/customers/${INACTIVE_ID}`,
      headers,
    });

    expect(active.statusCode).toBe(200);
    expect(Object.keys(active.json<Record<string, unknown>>()).sort()).toEqual(
      ['id', 'name', 'phone', 'email', 'isActive', 'createdAt', 'updatedAt'].sort(),
    );
    expect(inactive.json()).toMatchObject({ id: INACTIVE_ID, isActive: false });
  });

  it('returns CUSTOMER_NOT_FOUND for an unknown id', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: `/customers/${MISSING_ID}`,
      headers: { authorization: await authorization('ADMIN') },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json<ErrorResponse>().error.code).toBe('CUSTOMER_NOT_FOUND');
  });
});

describe('customer mutations', () => {
  it.each<TestRole>(['ADMIN', 'OPERATOR'])(
    'creates a normalized customer with %s',
    async (role) => {
      const response = await createApp().inject({
        method: 'POST',
        url: '/customers',
        headers: { authorization: await authorization(role) },
        payload: validPayload(),
      });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        name: 'Carlos Lima',
        phone: '61977776666',
        email: 'carlos@example.com',
        isActive: true,
      });
    },
  );

  it('rejects creation without a token', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/customers',
      payload: validPayload(),
    });
    expect(response.statusCode).toBe(401);
  });

  it('accepts an omitted or empty optional email', async () => {
    const headers = { authorization: await authorization('ADMIN') };
    const omitted = await createApp().inject({
      method: 'POST',
      url: '/customers',
      headers,
      payload: { name: 'Sem Email', phone: '61911112222' },
    });
    const empty = await createApp().inject({
      method: 'POST',
      url: '/customers',
      headers,
      payload: { name: 'Email Vazio', phone: '61911113333', email: '' },
    });
    expect(omitted.json()).toMatchObject({ email: null });
    expect(empty.json()).toMatchObject({ email: null });
  });

  it.each([
    ['phone', { name: 'Duplicado', phone: '(61) 99999-9999' }, 'CUSTOMER_PHONE_ALREADY_EXISTS'],
    ['email', { name: 'Duplicado', phone: '61911112222', email: 'JOAO@example.com' }, 'CUSTOMER_EMAIL_ALREADY_EXISTS'],
  ])('returns conflict for duplicate %s', async (_field, payload, code) => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/customers',
      headers: { authorization: await authorization('ADMIN') },
      payload,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json<ErrorResponse>().error.code).toBe(code);
  });

  it('updates an existing customer and returns 404 for a missing one', async () => {
    const headers = { authorization: await authorization('OPERATOR') };
    const updated = await createApp().inject({
      method: 'PATCH',
      url: `/customers/${CUSTOMER_ID}`,
      headers,
      payload: { name: '  João   Atualizado ', email: '' },
    });
    const missing = await createApp().inject({
      method: 'PATCH',
      url: `/customers/${MISSING_ID}`,
      headers,
      payload: { name: 'Não Existe' },
    });
    expect(updated.json()).toMatchObject({ name: 'João Atualizado', email: null });
    expect(missing.statusCode).toBe(404);
  });

  it('allows only ADMIN to update active status', async () => {
    const operator = await createApp().inject({
      method: 'PATCH',
      url: `/customers/${CUSTOMER_ID}`,
      headers: { authorization: await authorization('OPERATOR') },
      payload: { isActive: false },
    });
    const admin = await createApp().inject({
      method: 'PATCH',
      url: `/customers/${INACTIVE_ID}`,
      headers: { authorization: await authorization('ADMIN') },
      payload: { isActive: true },
    });
    expect(operator.statusCode).toBe(403);
    expect(admin.json()).toMatchObject({ id: INACTIVE_ID, isActive: true });
  });

  it('allows ADMIN to soft-delete and keeps the customer queryable', async () => {
    const app = createApp();
    const headers = { authorization: await authorization('ADMIN') };
    const deletion = await app.inject({
      method: 'DELETE',
      url: `/customers/${CUSTOMER_ID}`,
      headers,
    });
    const query = await app.inject({
      method: 'GET',
      url: `/customers/${CUSTOMER_ID}`,
      headers,
    });
    expect(deletion.json()).toMatchObject({ id: CUSTOMER_ID, isActive: false });
    expect(query.json()).toMatchObject({ id: CUSTOMER_ID, isActive: false });
    expect(repository.customers.some((customer) => customer.id === CUSTOMER_ID)).toBe(true);
  });

  it('forbids OPERATOR from deleting', async () => {
    const response = await createApp().inject({
      method: 'DELETE',
      url: `/customers/${CUSTOMER_ID}`,
      headers: { authorization: await authorization('OPERATOR') },
    });
    expect(response.statusCode).toBe(403);
    expect(repository.customers.find((customer) => customer.id === CUSTOMER_ID)?.isActive).toBe(true);
  });
});

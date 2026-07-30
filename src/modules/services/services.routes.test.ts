import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import type { ErrorResponse } from '../../shared/errors/error-response.js';
import type { ServiceRepository } from './services.repository.js';
import type {
  CreateServiceInput,
  ListServicesInput,
  ServiceEntity,
  UpdateServiceInput,
} from './services.types.js';

const ELECTRICAL_ID = '1ad575e6-0225-45ce-bb18-296407bc558b';
const INACTIVE_ID = '23ed23cf-22d0-414d-bbea-06b8b57b9703';
const PAINTING_ID = 'aa9a8c21-32fb-47ba-aef3-03ef668d727b';
const MISSING_ID = 'eadb62b5-6da8-4a7c-a135-c86bd4edff38';
const USER_ID = 'b32efc7d-bb72-4d0b-a64b-b34f4fc83bad';
const now = new Date('2026-07-30T12:00:00.000Z');
type TestRole = 'ADMIN' | 'OPERATOR';

const initialServices: ServiceEntity[] = [
  {
    id: ELECTRICAL_ID,
    name: 'Instalação elétrica',
    slug: 'instalacao-eletrica',
    description: 'Instalações e reparos elétricos residenciais.',
    category: 'ELECTRICAL',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: INACTIVE_ID,
    name: 'Reparo antigo',
    slug: 'reparo-antigo',
    description: 'Serviço indisponível.',
    category: 'ELECTRICAL',
    isActive: false,
    createdAt: new Date('2026-07-29T12:00:00.000Z'),
    updatedAt: now,
  },
  {
    id: PAINTING_ID,
    name: 'Pintura residencial',
    slug: 'pintura-residencial',
    description: 'Pintura de ambientes internos.',
    category: 'PAINTING',
    isActive: true,
    createdAt: new Date('2026-07-28T12:00:00.000Z'),
    updatedAt: now,
  },
];

class InMemoryServiceRepository implements ServiceRepository {
  readonly services: ServiceEntity[];

  constructor(services: ServiceEntity[]) {
    this.services = services.map((service) => ({ ...service }));
  }

  list(
    input: ListServicesInput,
  ): Promise<{ data: ServiceEntity[]; total: number }> {
    const filtered = this.services
      .filter(
        (service) =>
          input.isActive === undefined ||
          service.isActive === input.isActive,
      )
      .filter(
        (service) =>
          input.category === undefined ||
          service.category === input.category,
      )
      .filter(
        (service) =>
          input.search === undefined ||
          service.name.toLowerCase().includes(input.search.toLowerCase()),
      )
      .sort((left, right) => {
        const leftValue =
          input.orderBy === 'name' ? left.name : left.createdAt.getTime();
        const rightValue =
          input.orderBy === 'name' ? right.name : right.createdAt.getTime();
        const comparison =
          typeof leftValue === 'string'
            ? leftValue.localeCompare(rightValue as string)
            : leftValue - (rightValue as number);
        return input.sortOrder === 'asc' ? comparison : -comparison;
      });
    const start = (input.page - 1) * input.limit;

    return Promise.resolve({
      data: filtered.slice(start, start + input.limit),
      total: filtered.length,
    });
  }

  findBySlug(slug: string): Promise<ServiceEntity | null> {
    return Promise.resolve(
      this.services.find((service) => service.slug === slug) ?? null,
    );
  }

  findById(id: string): Promise<ServiceEntity | null> {
    return Promise.resolve(
      this.services.find((service) => service.id === id) ?? null,
    );
  }

  create(input: CreateServiceInput): Promise<ServiceEntity> {
    const service: ServiceEntity = {
      ...input,
      id: '91e17601-b2dd-43dd-8f02-071652606aaa',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.services.push(service);
    return Promise.resolve(service);
  }

  update(id: string, input: UpdateServiceInput): Promise<ServiceEntity> {
    const index = this.services.findIndex((service) => service.id === id);
    const current = this.services[index];
    if (index < 0 || current === undefined) {
      return Promise.reject(new Error('Service not found'));
    }
    const updated = { ...current, ...input, updatedAt: now };
    this.services[index] = updated;
    return Promise.resolve(updated);
  }
}

const apps = new Set<FastifyInstance>();
let repository: InMemoryServiceRepository;

function createApp(): FastifyInstance {
  const app = buildApp({ logger: false, serviceRepository: repository });
  apps.add(app);
  return app;
}

async function authorization(role: TestRole): Promise<string> {
  const app = createApp();
  await app.ready();
  return `Bearer ${app.jwt.sign({ sub: USER_ID, role })}`;
}

function validPayload(): CreateServiceInput {
  return {
    name: 'Hidráulica residencial',
    slug: 'hidraulica-residencial',
    description: 'Instalações e reparos hidráulicos.',
    category: 'PLUMBING',
  };
}

beforeEach(() => {
  repository = new InMemoryServiceRepository(initialServices);
});

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

describe('public service queries', () => {
  it('lists only active services by default without unexpected fields', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/services',
    });
    const payload = response.json<{
      data: Array<Record<string, unknown>>;
    }>();

    expect(response.statusCode).toBe(200);
    expect(payload.data).toHaveLength(2);
    expect(payload.data.every((service) => service.isActive === true)).toBe(
      true,
    );
    expect(Object.keys(payload.data[0] ?? {}).sort()).toEqual(
      [
        'category',
        'createdAt',
        'description',
        'id',
        'isActive',
        'name',
        'slug',
        'updatedAt',
      ].sort(),
    );
  });

  it('applies bounded pagination', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/services?page=2&limit=1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [{ slug: 'pintura-residencial' }],
      pagination: {
        page: 2,
        limit: 1,
        total: 2,
        totalPages: 2,
      },
    });
  });

  it('applies case-insensitive name search', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/services?search=PINTURA',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [{ slug: 'pintura-residencial' }],
    });
  });

  it('returns an active service by slug', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/services/instalacao-eletrica',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: ELECTRICAL_ID,
      slug: 'instalacao-eletrica',
      isActive: true,
    });
  });

  it('hides an inactive service from public slug queries', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/services/reparo-antigo',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json<ErrorResponse>().error.code).toBe(
      'SERVICE_NOT_FOUND',
    );
  });

  it('allows an authenticated user to query inactive services', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/services/reparo-antigo',
      headers: {
        authorization: await authorization('OPERATOR'),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      slug: 'reparo-antigo',
      isActive: false,
    });
  });
});

describe('service administration', () => {
  it('rejects creation without a token', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/services',
      payload: validPayload(),
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects creation by a non-admin user', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/services',
      headers: {
        authorization: await authorization('OPERATOR'),
      },
      payload: validPayload(),
    });

    expect(response.statusCode).toBe(403);
  });

  it('creates a valid service', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/services',
      headers: { authorization: await authorization('ADMIN') },
      payload: validPayload(),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      ...validPayload(),
      isActive: true,
    });
  });

  it('rejects an invalid slug', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/services',
      headers: { authorization: await authorization('ADMIN') },
      payload: { ...validPayload(), slug: 'Slug Inválido' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns conflict for a duplicate slug', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/services',
      headers: { authorization: await authorization('ADMIN') },
      payload: { ...validPayload(), slug: 'instalacao-eletrica' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<ErrorResponse>().error.code).toBe(
      'SERVICE_SLUG_CONFLICT',
    );
  });

  it('updates an existing service', async () => {
    const response = await createApp().inject({
      method: 'PATCH',
      url: `/services/${ELECTRICAL_ID}`,
      headers: { authorization: await authorization('ADMIN') },
      payload: { name: 'Instalações elétricas' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: ELECTRICAL_ID,
      name: 'Instalações elétricas',
    });
  });

  it('returns not found when updating a missing service', async () => {
    const response = await createApp().inject({
      method: 'PATCH',
      url: `/services/${MISSING_ID}`,
      headers: { authorization: await authorization('ADMIN') },
      payload: { name: 'Serviço inexistente' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json<ErrorResponse>().error.code).toBe(
      'SERVICE_NOT_FOUND',
    );
  });

  it('logically deactivates a service and hides it publicly', async () => {
    const app = createApp();
    const deactivation = await app.inject({
      method: 'DELETE',
      url: `/services/${ELECTRICAL_ID}`,
      headers: { authorization: await authorization('ADMIN') },
    });
    const publicList = await app.inject({
      method: 'GET',
      url: '/services',
    });

    expect(deactivation.statusCode).toBe(200);
    expect(deactivation.json()).toMatchObject({
      id: ELECTRICAL_ID,
      isActive: false,
    });
    expect(
      publicList
        .json<{ data: ServiceEntity[] }>()
        .data.some((service) => service.id === ELECTRICAL_ID),
    ).toBe(false);
  });
});

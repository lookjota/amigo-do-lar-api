import { Prisma } from '@prisma/client';

import { database } from '../../shared/database/index.js';
import { ConflictError } from '../../shared/errors/http-errors.js';
import type {
  CreateServiceInput,
  ListServicesInput,
  ServiceEntity,
  UpdateServiceInput,
} from './services.types.js';

export interface ServiceRepository {
  list(
    input: ListServicesInput,
  ): Promise<{ data: ServiceEntity[]; total: number }>;
  findBySlug(slug: string): Promise<ServiceEntity | null>;
  findById(id: string): Promise<ServiceEntity | null>;
  create(input: CreateServiceInput): Promise<ServiceEntity>;
  update(id: string, input: UpdateServiceInput): Promise<ServiceEntity>;
}

const slugConflict = () =>
  new ConflictError({
    code: 'SERVICE_SLUG_CONFLICT',
    message: 'A service with this slug already exists',
  });

export class PrismaServiceRepository implements ServiceRepository {
  async list(
    input: ListServicesInput,
  ): Promise<{ data: ServiceEntity[]; total: number }> {
    const where: Prisma.ServiceWhereInput = {
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      ...(input.category === undefined ? {} : { category: input.category }),
      ...(input.search === undefined
        ? {}
        : { name: { contains: input.search, mode: 'insensitive' } }),
    };
    const orderBy: Prisma.ServiceOrderByWithRelationInput = {
      [input.orderBy]: input.sortOrder,
    };
    const [data, total] = await database.$transaction([
      database.service.findMany({
        where,
        orderBy,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      database.service.count({ where }),
    ]);

    return { data, total };
  }

  async findBySlug(slug: string): Promise<ServiceEntity | null> {
    return database.service.findUnique({ where: { slug } });
  }

  async findById(id: string): Promise<ServiceEntity | null> {
    return database.service.findUnique({ where: { id } });
  }

  async create(input: CreateServiceInput): Promise<ServiceEntity> {
    try {
      return await database.service.create({ data: input });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw slugConflict();
      }
      throw error;
    }
  }

  async update(
    id: string,
    input: UpdateServiceInput,
  ): Promise<ServiceEntity> {
    try {
      return await database.service.update({ where: { id }, data: input });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw slugConflict();
      }
      throw error;
    }
  }
}

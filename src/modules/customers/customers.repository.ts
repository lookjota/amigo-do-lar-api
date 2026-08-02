import { Prisma } from '@prisma/client';

import { database } from '../../shared/database/index.js';
import { ConflictError } from '../../shared/errors/http-errors.js';
import type {
  CreateCustomerData,
  CustomerEntity,
  ListCustomersInput,
  UpdateCustomerData,
} from './customers.types.js';

export interface CustomerRepository {
  list(
    input: ListCustomersInput,
  ): Promise<{ data: CustomerEntity[]; total: number }>;
  findById(id: string): Promise<CustomerEntity | null>;
  findByPhone(phone: string): Promise<CustomerEntity | null>;
  findByEmail(email: string): Promise<CustomerEntity | null>;
  create(input: CreateCustomerData): Promise<CustomerEntity>;
  update(id: string, input: UpdateCustomerData): Promise<CustomerEntity>;
}

function uniqueFields(error: Prisma.PrismaClientKnownRequestError): string[] {
  const target = error.meta?.target;
  return Array.isArray(target)
    ? target.filter((field): field is string => typeof field === 'string')
    : [];
}

function customerConflict(error: unknown): ConflictError | undefined {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return undefined;
  }

  const fields = uniqueFields(error);
  if (fields.some((field) => field.includes('phone'))) {
    return new ConflictError({
      code: 'CUSTOMER_PHONE_ALREADY_EXISTS',
      message: 'A customer with this phone already exists',
    });
  }
  if (fields.some((field) => field.includes('email'))) {
    return new ConflictError({
      code: 'CUSTOMER_EMAIL_ALREADY_EXISTS',
      message: 'A customer with this email already exists',
    });
  }

  return new ConflictError({
    code: 'CUSTOMER_ALREADY_EXISTS',
    message: 'A customer with the provided data already exists',
  });
}

export class PrismaCustomerRepository implements CustomerRepository {
  async list(
    input: ListCustomersInput,
  ): Promise<{ data: CustomerEntity[]; total: number }> {
    const where: Prisma.CustomerWhereInput = {
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      ...(input.search === undefined
        ? {}
        : {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { phone: { contains: input.search } },
              { email: { contains: input.search, mode: 'insensitive' } },
            ],
          }),
    };
    const orderBy: Prisma.CustomerOrderByWithRelationInput = {
      [input.sortBy]: input.sortOrder,
    };
    const [data, total] = await database.$transaction([
      database.customer.findMany({
        where,
        orderBy,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      database.customer.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<CustomerEntity | null> {
    return database.customer.findUnique({ where: { id } });
  }

  async findByPhone(phone: string): Promise<CustomerEntity | null> {
    return database.customer.findUnique({ where: { phone } });
  }

  async findByEmail(email: string): Promise<CustomerEntity | null> {
    return database.customer.findUnique({ where: { email } });
  }

  async create(input: CreateCustomerData): Promise<CustomerEntity> {
    try {
      return await database.customer.create({ data: input });
    } catch (error) {
      const conflict = customerConflict(error);
      if (conflict !== undefined) throw conflict;
      throw error;
    }
  }

  async update(
    id: string,
    input: UpdateCustomerData,
  ): Promise<CustomerEntity> {
    try {
      return await database.customer.update({ where: { id }, data: input });
    } catch (error) {
      const conflict = customerConflict(error);
      if (conflict !== undefined) throw conflict;
      throw error;
    }
  }
}

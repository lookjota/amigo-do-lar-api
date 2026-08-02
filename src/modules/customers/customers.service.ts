import type { UserRole } from '@prisma/client';

import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/http-errors.js';
import type { CustomerRepository } from './customers.repository.js';
import {
  CUSTOMER_NAME_MAX_LENGTH,
  CUSTOMER_NAME_MIN_LENGTH,
  type CreateCustomerInput,
  type CustomerEntity,
  type CustomerListResult,
  type ListCustomersInput,
  type UpdateCustomerInput,
} from './customers.types.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const customerNotFound = () =>
  new NotFoundError({
    code: 'CUSTOMER_NOT_FOUND',
    message: 'Customer not found',
  });

const phoneConflict = () =>
  new ConflictError({
    code: 'CUSTOMER_PHONE_ALREADY_EXISTS',
    message: 'A customer with this phone already exists',
  });

const emailConflict = () =>
  new ConflictError({
    code: 'CUSTOMER_EMAIL_ALREADY_EXISTS',
    message: 'A customer with this email already exists',
  });

function customerValidationError(
  field: string,
  message: string,
  code = 'INVALID_CUSTOMER_DATA',
): BadRequestError {
  return new BadRequestError({
    code,
    message: 'Customer data is invalid',
    details: [{ field, message }],
  });
}

export function normalizeCustomerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function normalizeCustomerPhone(phone: string): string {
  if (!/^[\d\s()+.-]+$/.test(phone)) {
    throw customerValidationError(
      'phone',
      'Phone contains invalid characters',
      'INVALID_CUSTOMER_PHONE',
    );
  }
  const normalized = phone.replace(/\D/g, '');
  if (normalized.length !== 10 && normalized.length !== 11) {
    throw customerValidationError(
      'phone',
      'Phone must contain 10 or 11 digits',
      'INVALID_CUSTOMER_PHONE',
    );
  }
  return normalized;
}

export function normalizeCustomerEmail(
  email: string | null | undefined,
): string | null {
  if (email === null || email === undefined || email.trim() === '') return null;

  const normalized = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) {
    throw customerValidationError('email', 'Email must be valid');
  }
  return normalized;
}

function normalizeAndValidateName(name: string): string {
  const normalized = normalizeCustomerName(name);
  if (
    normalized.length < CUSTOMER_NAME_MIN_LENGTH ||
    normalized.length > CUSTOMER_NAME_MAX_LENGTH
  ) {
    throw customerValidationError(
      'name',
      `Name must have between ${CUSTOMER_NAME_MIN_LENGTH} and ${CUSTOMER_NAME_MAX_LENGTH} characters`,
    );
  }
  return normalized;
}

export class CustomersService {
  constructor(private readonly repository: CustomerRepository) {}

  async list(input: ListCustomersInput): Promise<CustomerListResult> {
    const { data, total } = await this.repository.list(input);
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

  async getById(id: string): Promise<CustomerEntity> {
    const customer = await this.repository.findById(id);
    if (customer === null) throw customerNotFound();
    return customer;
  }

  async create(input: CreateCustomerInput): Promise<CustomerEntity> {
    const name = normalizeAndValidateName(input.name);
    const phone = normalizeCustomerPhone(input.phone);
    const email = normalizeCustomerEmail(input.email);

    if ((await this.repository.findByPhone(phone)) !== null) {
      throw phoneConflict();
    }
    if (email !== null && (await this.repository.findByEmail(email)) !== null) {
      throw emailConflict();
    }

    return this.repository.create({ name, phone, email });
  }

  async update(
    id: string,
    input: UpdateCustomerInput,
    role: UserRole,
  ): Promise<CustomerEntity> {
    const existing = await this.repository.findById(id);
    if (existing === null) throw customerNotFound();
    if (input.isActive !== undefined && role !== 'ADMIN') {
      throw new ForbiddenError({
        code: 'CUSTOMER_STATUS_UPDATE_FORBIDDEN',
        message: 'Only administrators can update customer active status',
      });
    }

    const name =
      input.name === undefined ? undefined : normalizeAndValidateName(input.name);
    const phone =
      input.phone === undefined
        ? undefined
        : normalizeCustomerPhone(input.phone);
    const email =
      input.email === undefined ? undefined : normalizeCustomerEmail(input.email);

    if (
      phone !== undefined &&
      phone !== existing.phone &&
      (await this.repository.findByPhone(phone)) !== null
    ) {
      throw phoneConflict();
    }
    if (
      email !== undefined &&
      email !== null &&
      email !== existing.email &&
      (await this.repository.findByEmail(email)) !== null
    ) {
      throw emailConflict();
    }

    return this.repository.update(id, {
      ...input,
      ...(name === undefined ? {} : { name }),
      ...(phone === undefined ? {} : { phone }),
      ...(email === undefined ? {} : { email }),
    });
  }

  async deactivate(id: string): Promise<CustomerEntity> {
    if ((await this.repository.findById(id)) === null) throw customerNotFound();
    return this.repository.update(id, { isActive: false });
  }
}

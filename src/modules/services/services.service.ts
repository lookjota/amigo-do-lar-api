import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/http-errors.js';
import type { ServiceRepository } from './services.repository.js';
import {
  SERVICE_DESCRIPTION_MAX_LENGTH,
  SERVICE_NAME_MAX_LENGTH,
  SERVICE_NAME_MIN_LENGTH,
  SERVICE_SLUG_PATTERN,
  type CreateServiceInput,
  type ListServicesInput,
  type ServiceEntity,
  type ServiceListResult,
  type UpdateServiceInput,
} from './services.types.js';

const serviceNotFound = () =>
  new NotFoundError({
    code: 'SERVICE_NOT_FOUND',
    message: 'Service not found',
  });

const slugConflict = () =>
  new ConflictError({
    code: 'SERVICE_SLUG_CONFLICT',
    message: 'A service with this slug already exists',
  });

function validationError(field: string, message: string): BadRequestError {
  return new BadRequestError({
    code: 'SERVICE_VALIDATION_ERROR',
    message: 'Service data is invalid',
    details: [{ field, message }],
  });
}

function validateName(name: string): void {
  const length = name.trim().length;
  if (
    length < SERVICE_NAME_MIN_LENGTH ||
    length > SERVICE_NAME_MAX_LENGTH
  ) {
    throw validationError(
      'name',
      `Name must have between ${SERVICE_NAME_MIN_LENGTH} and ${SERVICE_NAME_MAX_LENGTH} characters`,
    );
  }
}

function validateSlug(slug: string): void {
  if (!SERVICE_SLUG_PATTERN.test(slug)) {
    throw validationError(
      'slug',
      'Slug must be lowercase and use kebab-case',
    );
  }
}

function validateDescription(description: string): void {
  if (
    description.trim().length === 0 ||
    description.length > SERVICE_DESCRIPTION_MAX_LENGTH
  ) {
    throw validationError(
      'description',
      `Description is required and must have at most ${SERVICE_DESCRIPTION_MAX_LENGTH} characters`,
    );
  }
}

function validateCategory(category: string): void {
  if (category.trim().length === 0) {
    throw validationError('category', 'Category is required');
  }
}

export class ServicesService {
  constructor(private readonly repository: ServiceRepository) {}

  async list(
    input: ListServicesInput,
    isAuthenticated: boolean,
  ): Promise<ServiceListResult> {
    if (input.isActive !== undefined && !isAuthenticated) {
      throw new ForbiddenError({
        code: 'SERVICE_ACTIVE_FILTER_FORBIDDEN',
        message: 'Authentication is required to filter by active status',
      });
    }

    const filters = {
      ...input,
      isActive: input.isActive ?? true,
    };
    const { data, total } = await this.repository.list(filters);

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

  async getBySlug(
    slug: string,
    isAuthenticated: boolean,
  ): Promise<ServiceEntity> {
    const service = await this.repository.findBySlug(slug);

    if (service === null || (!service.isActive && !isAuthenticated)) {
      throw serviceNotFound();
    }

    return service;
  }

  async create(input: CreateServiceInput): Promise<ServiceEntity> {
    this.validateCreate(input);
    if ((await this.repository.findBySlug(input.slug)) !== null) {
      throw slugConflict();
    }

    return this.repository.create({
      ...input,
      name: input.name.trim(),
      description: input.description.trim(),
      category: input.category.trim(),
    });
  }

  async update(
    id: string,
    input: UpdateServiceInput,
  ): Promise<ServiceEntity> {
    const existing = await this.repository.findById(id);
    if (existing === null) {
      throw serviceNotFound();
    }

    this.validateUpdate(input);
    if (
      input.slug !== undefined &&
      input.slug !== existing.slug &&
      (await this.repository.findBySlug(input.slug)) !== null
    ) {
      throw slugConflict();
    }

    return this.repository.update(id, {
      ...input,
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.description === undefined
        ? {}
        : { description: input.description.trim() }),
      ...(input.category === undefined
        ? {}
        : { category: input.category.trim() }),
    });
  }

  async deactivate(id: string): Promise<ServiceEntity> {
    if ((await this.repository.findById(id)) === null) {
      throw serviceNotFound();
    }

    return this.repository.update(id, { isActive: false });
  }

  private validateCreate(input: CreateServiceInput): void {
    validateName(input.name);
    validateSlug(input.slug);
    validateDescription(input.description);
    validateCategory(input.category);
  }

  private validateUpdate(input: UpdateServiceInput): void {
    if (input.name !== undefined) validateName(input.name);
    if (input.slug !== undefined) validateSlug(input.slug);
    if (input.description !== undefined) {
      validateDescription(input.description);
    }
    if (input.category !== undefined) validateCategory(input.category);
  }
}

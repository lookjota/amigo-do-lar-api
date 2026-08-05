import { hashPassword } from '../../shared/auth/password.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/http-errors.js';
import type { UserRepository } from './users.repository.js';
import type {
  CreateUserInput, ListUsersInput, PublicUserEntity, ResetUserPasswordInput,
  UpdateUserInput, UpdateUserStatusInput, UserListResult, UserMutationResult,
} from './users.types.js';
import { USER_NAME_MAX_LENGTH, USER_NAME_MIN_LENGTH } from './users.types.js';

const userNotFound = () => new NotFoundError({ code: 'USER_NOT_FOUND', message: 'User not found' });
const emailConflict = () => new ConflictError({ code: 'USER_EMAIL_ALREADY_EXISTS', message: 'A user with this email already exists' });
const lastAdminConflict = () => new ConflictError({ code: 'LAST_ACTIVE_ADMIN', message: 'The last active administrator cannot be deactivated or demoted' });

function normalizeName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (normalized.length < USER_NAME_MIN_LENGTH || normalized.length > USER_NAME_MAX_LENGTH) {
    throw new BadRequestError({ code: 'INVALID_USER_DATA', message: 'User data is invalid', details: [{ field: 'name', message: `Name must have between ${USER_NAME_MIN_LENGTH} and ${USER_NAME_MAX_LENGTH} characters` }] });
  }
  return normalized;
}

export function normalizeUserEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 320) {
    throw new BadRequestError({ code: 'INVALID_USER_DATA', message: 'User data is invalid', details: [{ field: 'email', message: 'Email must be valid' }] });
  }
  return normalized;
}

export class UsersService {
  constructor(private readonly repository: UserRepository) {}

  private async assertActiveAdmin(actorId: string): Promise<void> {
    const actor = await this.repository.findById(actorId);
    if (actor === null || !actor.isActive || actor.role !== 'ADMIN') {
      throw new ForbiddenError({ code: 'ADMIN_ACCESS_REQUIRED', message: 'Active administrator access is required' });
    }
  }

  private mutationResult(result: UserMutationResult): PublicUserEntity {
    if (result.outcome === 'not_found') throw userNotFound();
    if (result.outcome === 'last_active_admin') throw lastAdminConflict();
    return result.user;
  }

  async list(input: ListUsersInput, actorId: string): Promise<UserListResult> {
    await this.assertActiveAdmin(actorId);
    const { data, total } = await this.repository.list(input);
    return { data, pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }

  async getById(id: string, actorId: string): Promise<PublicUserEntity> {
    await this.assertActiveAdmin(actorId);
    const user = await this.repository.findById(id);
    if (user === null) throw userNotFound();
    return user;
  }

  async create(input: CreateUserInput, actorId: string): Promise<PublicUserEntity> {
    await this.assertActiveAdmin(actorId);
    const email = normalizeUserEmail(input.email);
    if (await this.repository.findByEmail(email)) throw emailConflict();
    const passwordHash = await hashPassword(input.password);
    return this.repository.create({ name: normalizeName(input.name), email, passwordHash, role: input.role, isActive: input.isActive ?? true });
  }

  async update(id: string, input: UpdateUserInput, actorId: string): Promise<PublicUserEntity> {
    await this.assertActiveAdmin(actorId);
    const existing = await this.repository.findById(id);
    if (existing === null) throw userNotFound();
    const email = input.email === undefined ? undefined : normalizeUserEmail(input.email);
    if (email !== undefined && email !== existing.email && await this.repository.findByEmail(email)) throw emailConflict();
    return this.mutationResult(await this.repository.update(id, {
      ...(input.name === undefined ? {} : { name: normalizeName(input.name) }),
      ...(email === undefined ? {} : { email }),
      ...(input.role === undefined ? {} : { role: input.role }),
    }));
  }

  async updateStatus(id: string, input: UpdateUserStatusInput, actorId: string): Promise<PublicUserEntity> {
    await this.assertActiveAdmin(actorId);
    if (id === actorId && !input.isActive) throw new ConflictError({ code: 'SELF_DEACTIVATION_FORBIDDEN', message: 'Administrators cannot deactivate their own account' });
    return this.mutationResult(await this.repository.updateStatus(id, input.isActive));
  }

  async resetPassword(id: string, input: ResetUserPasswordInput, actorId: string): Promise<void> {
    await this.assertActiveAdmin(actorId);
    const passwordHash = await hashPassword(input.password);
    if (!await this.repository.updatePassword(id, passwordHash)) throw userNotFound();
  }
}

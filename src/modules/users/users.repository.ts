import { Prisma } from '@prisma/client';

import { database } from '../../shared/database/index.js';
import { ConflictError } from '../../shared/errors/http-errors.js';
import type {
  CreateUserData,
  ListUsersInput,
  PublicUserEntity,
  UpdateUserData,
  UserMutationResult,
} from './users.types.js';

const publicUserSelect = {
  id: true, name: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true,
} satisfies Prisma.UserSelect;

export interface UserRepository {
  list(input: ListUsersInput): Promise<{ data: PublicUserEntity[]; total: number }>;
  findById(id: string): Promise<PublicUserEntity | null>;
  findByEmail(email: string): Promise<PublicUserEntity | null>;
  create(input: CreateUserData): Promise<PublicUserEntity>;
  update(id: string, input: UpdateUserData): Promise<UserMutationResult>;
  updateStatus(id: string, isActive: boolean): Promise<UserMutationResult>;
  updatePassword(id: string, passwordHash: string): Promise<boolean>;
}

function emailConflict(error: unknown): ConflictError | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return undefined;
  return new ConflictError({
    code: 'USER_EMAIL_ALREADY_EXISTS',
    message: 'A user with this email already exists',
  });
}

async function mutateWithAdminGuard(
  id: string,
  data: Prisma.UserUpdateInput,
): Promise<UserMutationResult> {
  return database.$transaction(async (transaction) => {
    const existing = await transaction.user.findUnique({ where: { id }, select: publicUserSelect });
    if (existing === null) return { outcome: 'not_found' };
    const removesActiveAdmin = existing.role === 'ADMIN' && existing.isActive &&
      (data.role === 'OPERATOR' || data.isActive === false);
    if (removesActiveAdmin) {
      const activeAdmins = await transaction.user.count({ where: { role: 'ADMIN', isActive: true } });
      if (activeAdmins <= 1) return { outcome: 'last_active_admin' };
    }
    const user = await transaction.user.update({ where: { id }, data, select: publicUserSelect });
    return { outcome: 'updated', user };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export class PrismaUserRepository implements UserRepository {
  async list(input: ListUsersInput): Promise<{ data: PublicUserEntity[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      ...(input.role === undefined ? {} : { role: input.role }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      ...(input.search === undefined ? {} : { OR: [
        { name: { contains: input.search, mode: 'insensitive' } },
        { email: { contains: input.search, mode: 'insensitive' } },
      ] }),
    };
    const [data, total] = await database.$transaction([
      database.user.findMany({
        where, select: publicUserSelect, orderBy: { [input.orderBy]: input.sortOrder },
        skip: (input.page - 1) * input.limit, take: input.limit,
      }),
      database.user.count({ where }),
    ]);
    return { data, total };
  }

  findById(id: string): Promise<PublicUserEntity | null> {
    return database.user.findUnique({ where: { id }, select: publicUserSelect });
  }

  findByEmail(email: string): Promise<PublicUserEntity | null> {
    return database.user.findUnique({ where: { email }, select: publicUserSelect });
  }

  async create(input: CreateUserData): Promise<PublicUserEntity> {
    try {
      return await database.user.create({ data: input, select: publicUserSelect });
    } catch (error) {
      const conflict = emailConflict(error);
      if (conflict !== undefined) throw conflict;
      throw error;
    }
  }

  async update(id: string, input: UpdateUserData): Promise<UserMutationResult> {
    try { return await mutateWithAdminGuard(id, input); }
    catch (error) { const conflict = emailConflict(error); if (conflict !== undefined) throw conflict; throw error; }
  }

  updateStatus(id: string, isActive: boolean): Promise<UserMutationResult> {
    return mutateWithAdminGuard(id, { isActive });
  }

  async updatePassword(id: string, passwordHash: string): Promise<boolean> {
    const result = await database.user.updateMany({ where: { id }, data: { passwordHash } });
    return result.count === 1;
  }
}

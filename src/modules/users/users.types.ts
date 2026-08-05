import type { UserRole } from '@prisma/client';

export const USER_NAME_MIN_LENGTH = 2;
export const USER_NAME_MAX_LENGTH = 120;
export const USER_PASSWORD_MIN_LENGTH = 12;
export const USER_DEFAULT_LIMIT = 20;
export const USER_MAX_LIMIT = 100;

export interface PublicUserEntity {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isActive?: boolean;
}

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: UserRole;
}

export interface UpdateUserStatusInput { isActive: boolean }
export interface ResetUserPasswordInput { password: string }
export type UserOrderBy = 'name' | 'email' | 'role' | 'isActive' | 'createdAt' | 'updatedAt';
export type UserSortOrder = 'asc' | 'desc';

export interface ListUsersInput {
  page: number;
  limit: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  orderBy: UserOrderBy;
  sortOrder: UserSortOrder;
}

export interface UserListResult {
  data: PublicUserEntity[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export type UserMutationResult =
  | { outcome: 'updated'; user: PublicUserEntity }
  | { outcome: 'not_found' }
  | { outcome: 'last_active_admin' };

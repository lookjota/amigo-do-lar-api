import { database } from '../../shared/database/index.js';
import type { AuthUser } from './auth.types.js';

export interface AuthRepository {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
}

export class PrismaAuthRepository implements AuthRepository {
  async findByEmail(email: string): Promise<AuthUser | null> {
    return database.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<AuthUser | null> {
    return database.user.findUnique({ where: { id } });
  }
}

import type { UserRole } from '@prisma/client';

import { UnauthorizedError } from '../../shared/errors/http-errors.js';
import { verifyPassword } from '../../shared/auth/password.js';
import type { AuthRepository } from './auth.repository.js';
import type {
  LoginInput,
  LoginResult,
  PublicUser,
} from './auth.types.js';

const INVALID_CREDENTIALS = {
  code: 'INVALID_CREDENTIALS',
  message: 'Invalid email or password',
} as const;

export interface AccessTokenIssuer {
  sign(payload: { sub: string; role: UserRole }): string;
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly tokenIssuer: AccessTokenIssuer,
    private readonly expiresIn: number,
  ) {}

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.repository.findByEmail(input.email.toLowerCase());

    if (
      user === null ||
      !user.isActive ||
      !(await verifyPassword(user.passwordHash, input.password))
    ) {
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }

    const accessToken = this.tokenIssuer.sign({
      sub: user.id,
      role: user.role,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.expiresIn,
      user: this.toPublicUser(user),
    };
  }

  async getAuthenticatedUser(userId: string): Promise<PublicUser> {
    const user = await this.repository.findById(userId);

    if (user === null || !user.isActive) {
      throw new UnauthorizedError();
    }

    return this.toPublicUser(user);
  }

  private toPublicUser(user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  }): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}

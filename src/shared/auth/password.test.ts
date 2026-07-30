import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password.js';

describe('password utilities', () => {
  it('hashes a password without preserving its plain text value', async () => {
    const password = 'secure-password';
    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toBe(password);
    await expect(verifyPassword(passwordHash, password)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const passwordHash = await hashPassword('correct-password');

    await expect(
      verifyPassword(passwordHash, 'incorrect-password'),
    ).resolves.toBe(false);
  });
});

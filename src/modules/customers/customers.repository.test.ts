import { beforeEach, describe, expect, it, vi } from 'vitest';

const databaseMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../shared/database/index.js', () => ({
  database: {
    customer: {
      findMany: databaseMocks.findMany,
      count: databaseMocks.count,
    },
    $transaction: databaseMocks.transaction,
  },
}));

import { PrismaCustomerRepository } from './customers.repository.js';

describe('PrismaCustomerRepository.list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.findMany.mockResolvedValue([]);
    databaseMocks.count.mockResolvedValue(0);
    databaseMocks.transaction.mockImplementation(
      async (operations: Array<Promise<unknown>>) => Promise.all(operations),
    );
  });

  it('maps search, active filter, sorting and pagination to Prisma', async () => {
    const repository = new PrismaCustomerRepository();
    const result = await repository.list({
      page: 3,
      limit: 10,
      search: 'joao',
      isActive: false,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });

    const expectedWhere = {
      isActive: false,
      OR: [
        { name: { contains: 'joao', mode: 'insensitive' } },
        { phone: { contains: 'joao' } },
        { email: { contains: 'joao', mode: 'insensitive' } },
      ],
    };
    expect(databaseMocks.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      orderBy: { updatedAt: 'desc' },
      skip: 20,
      take: 10,
    });
    expect(databaseMocks.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(result).toEqual({ data: [], total: 0 });
  });
});

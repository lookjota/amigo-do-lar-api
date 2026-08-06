import { BadRequestError, NotFoundError } from '../../shared/errors/http-errors.js';
import { mapActivityEvent } from './service-request-activity.mapper.js';
import type { ServiceRequestActivityRepository } from './service-request-activity.repository.js';
import type { ActivityCursor, ActivityListResult, ListActivityQuery } from './service-request-activity.types.js';

interface SerializedCursor { createdAt: string; id: string }
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalidCursor(): BadRequestError {
  return new BadRequestError({ code: 'VALIDATION_ERROR', message: 'Request validation failed', details: [{ field: 'cursor', message: 'Cursor is invalid' }] });
}

export function encodeActivityCursor(cursor: ActivityCursor): string {
  return Buffer.from(JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id } satisfies SerializedCursor)).toString('base64url');
}

export function decodeActivityCursor(value: string): ActivityCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw invalidCursor();
    const record = parsed as Record<string, unknown>;
    if (Object.keys(record).length !== 2 || typeof record.createdAt !== 'string' || typeof record.id !== 'string' || !uuidPattern.test(record.id)) throw invalidCursor();
    const createdAt = new Date(record.createdAt);
    if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== record.createdAt) throw invalidCursor();
    return { createdAt, id: record.id };
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    throw invalidCursor();
  }
}

export class ServiceRequestActivityService {
  constructor(private readonly repository: ServiceRequestActivityRepository) {}

  async list(serviceRequestId: string, input: ListActivityQuery): Promise<ActivityListResult> {
    if (!(await this.repository.serviceRequestExists(serviceRequestId))) {
      throw new NotFoundError({ code: 'SERVICE_REQUEST_NOT_FOUND', message: 'Service request not found' });
    }
    const cursor = input.cursor === undefined ? undefined : decodeActivityCursor(input.cursor);
    const events = await this.repository.list(serviceRequestId, {
      limit: input.limit, sortOrder: input.sortOrder,
      ...(input.type === undefined ? {} : { type: input.type }),
      ...(input.category === undefined ? {} : { category: input.category }),
      ...(cursor === undefined ? {} : { cursor }),
    });
    const hasMore = events.length > input.limit;
    const page = events.slice(0, input.limit);
    const last = page.at(-1);
    return {
      data: page.map(mapActivityEvent),
      pagination: { hasMore, limit: input.limit, nextCursor: hasMore && last !== undefined ? encodeActivityCursor({ createdAt: last.createdAt, id: last.id }) : null },
    };
  }
}

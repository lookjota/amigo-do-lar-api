import { BadRequestError, NotFoundError } from '../../shared/errors/http-errors.js';
import type { ServiceRequestTimelineRepository } from './service-request-timeline.repository.js';
import {
  TIMELINE_COMMENT_MAX_LENGTH,
  type CreateTimelineCommentInput,
  type ListTimelineInput,
  type TimelineEvent,
  type TimelineListResult,
} from './service-request-timeline.types.js';

const requestNotFound = () => new NotFoundError({ code: 'SERVICE_REQUEST_NOT_FOUND', message: 'Service request not found' });

export class ServiceRequestTimelineService {
  constructor(private readonly repository: ServiceRequestTimelineRepository) {}

  async list(serviceRequestId: string, input: ListTimelineInput): Promise<TimelineListResult> {
    if (!(await this.repository.serviceRequestExists(serviceRequestId))) throw requestNotFound();
    const { data, total } = await this.repository.list(serviceRequestId, input);
    return { data, pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }

  async addComment(serviceRequestId: string, actorUserId: string, input: CreateTimelineCommentInput): Promise<TimelineEvent> {
    const content = input.content.trim();
    if (content.length === 0 || content.length > TIMELINE_COMMENT_MAX_LENGTH) {
      throw new BadRequestError({
        code: 'TIMELINE_COMMENT_INVALID',
        message: 'Timeline comment is invalid',
        details: [{ field: 'content', message: `Content must have between 1 and ${TIMELINE_COMMENT_MAX_LENGTH} characters after trimming` }],
      });
    }
    const event = await this.repository.createComment(serviceRequestId, actorUserId, content);
    if (event === null) throw requestNotFound();
    return event;
  }
}

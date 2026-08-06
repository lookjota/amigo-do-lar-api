import type { Prisma, ServiceRequestEventType, UserRole } from '@prisma/client';

export const ACTIVITY_DEFAULT_LIMIT = 20;
export const ACTIVITY_MAX_LIMIT = 100;

export const activityItemTypes = [
  'REQUEST', 'STATUS', 'COMMENT', 'APPOINTMENT', 'QUOTE', 'PAYMENT', 'ATTACHMENT',
] as const;
export type ActivityItemType = (typeof activityItemTypes)[number];

export const activityResourceTypes = [
  'SERVICE_REQUEST', 'APPOINTMENT', 'QUOTE', 'PAYMENT', 'ATTACHMENT',
] as const;
export type ActivityResourceType = (typeof activityResourceTypes)[number];

export interface ActivityActor {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface ActivityEvent {
  id: string;
  serviceRequestId: string;
  type: ServiceRequestEventType;
  title: string;
  description: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  actor: ActivityActor | null;
}

export type ActivityDetails = Readonly<Record<string, string>>;

export interface ActivityItem {
  id: string;
  eventType: ServiceRequestEventType;
  activityType: ActivityItemType;
  title: string;
  description: string | null;
  createdAt: Date;
  actor: ActivityActor | null;
  resource: { type: ActivityResourceType; id: string | null };
  details: ActivityDetails | null;
}

export interface ActivityCursor { createdAt: Date; id: string }

export interface ListActivityQuery {
  cursor?: string;
  limit: number;
  type?: ServiceRequestEventType;
  category?: ActivityItemType;
  sortOrder: 'asc' | 'desc';
}

export interface ListActivityRepositoryInput {
  cursor?: ActivityCursor;
  limit: number;
  type?: ServiceRequestEventType;
  category?: ActivityItemType;
  sortOrder: 'asc' | 'desc';
}

export interface ActivityListResult {
  data: ActivityItem[];
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
}

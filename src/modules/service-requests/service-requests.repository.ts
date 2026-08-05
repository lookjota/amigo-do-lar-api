import { Prisma } from '@prisma/client';

import { database } from '../../shared/database/index.js';
import { appendTimelineEvent } from '../service-request-timeline/service-request-timeline.repository.js';
import { EVENT_TITLES } from '../service-request-timeline/service-request-timeline.types.js';
import type {
  CreatePublicRequestResult,
  NormalizedCreateServiceRequestData,
  ServiceRequestEntity,
  ServiceRequestListFilters,
  UpdateServiceRequestData,
  UpdateServiceRequestStatusData,
} from './service-requests.types.js';

const relations = {
  customer: {
    select: { id: true, name: true, phone: true, email: true, isActive: true },
  },
  service: {
    select: { id: true, name: true, slug: true, category: true, isActive: true },
  },
} satisfies Prisma.ServiceRequestInclude;

export interface ServiceRequestRepository {
  createPublic(input: NormalizedCreateServiceRequestData): Promise<CreatePublicRequestResult>;
  list(input: ServiceRequestListFilters): Promise<{ data: ServiceRequestEntity[]; total: number }>;
  findById(id: string): Promise<ServiceRequestEntity | null>;
  update(id: string, input: UpdateServiceRequestData): Promise<ServiceRequestEntity>;
  updateStatus(id: string, input: UpdateServiceRequestStatusData): Promise<ServiceRequestEntity>;
}

function uniqueCustomerField(error: unknown): 'phone' | 'email' | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return undefined;
  const target = error.meta?.target;
  if (!Array.isArray(target)) return undefined;
  if (target.some((field) => String(field).includes('phone'))) return 'phone';
  if (target.some((field) => String(field).includes('email'))) return 'email';
  return undefined;
}

export class PrismaServiceRequestRepository implements ServiceRequestRepository {
  async createPublic(input: NormalizedCreateServiceRequestData): Promise<CreatePublicRequestResult> {
    try {
      return await database.$transaction(async (transaction) => {
        const service = await transaction.service.findUnique({ where: { id: input.serviceId } });
        if (service === null) return { outcome: 'service_not_found' };
        if (!service.isActive) return { outcome: 'service_inactive' };

        let customer = await transaction.customer.findUnique({ where: { phone: input.customer.phone } });
        if (customer === null) {
          customer = await transaction.customer.create({ data: input.customer });
        }

        const duplicate = await transaction.serviceRequest.findFirst({
          where: {
            customerId: customer.id,
            serviceId: input.serviceId,
            description: input.description,
            createdAt: { gte: input.duplicateSince },
          },
          select: { id: true },
        });
        if (duplicate !== null) return { outcome: 'duplicate' };

        const request = await transaction.serviceRequest.create({
          data: {
            customerId: customer.id,
            serviceId: input.serviceId,
            description: input.description,
            preferredDate: input.preferredDate,
            address: input.address,
            city: input.city,
          },
          include: relations,
        });
        await appendTimelineEvent(transaction, {
          serviceRequestId: request.id,
          type: 'REQUEST_CREATED',
          title: EVENT_TITLES.REQUEST_CREATED,
        });
        return { outcome: 'created', request };
      });
    } catch (error) {
      const field = uniqueCustomerField(error);
      if (field === 'phone') return { outcome: 'customer_phone_conflict' };
      if (field === 'email') return { outcome: 'customer_email_conflict' };
      throw error;
    }
  }

  async list(input: ServiceRequestListFilters): Promise<{ data: ServiceRequestEntity[]; total: number }> {
    const where: Prisma.ServiceRequestWhereInput = this.listWhere(input);
    const [data, total] = await database.$transaction([
      database.serviceRequest.findMany({
        where,
        include: relations,
        orderBy: { [input.sortBy]: input.sortOrder },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      database.serviceRequest.count({ where }),
    ]);
    return { data, total };
  }

  async findById(id: string): Promise<ServiceRequestEntity | null> {
    return database.serviceRequest.findUnique({ where: { id }, include: relations });
  }

  async update(id: string, input: UpdateServiceRequestData): Promise<ServiceRequestEntity> {
    return database.serviceRequest.update({ where: { id }, data: input, include: relations });
  }

  async updateStatus(id: string, input: UpdateServiceRequestStatusData): Promise<ServiceRequestEntity> {
    return database.$transaction(async (transaction) => {
      const request = await transaction.serviceRequest.update({
        where: { id, status: input.previousStatus },
        data: { status: input.status, completedAt: input.completedAt, cancelledAt: input.cancelledAt },
        include: relations,
      });
      await appendTimelineEvent(transaction, {
        serviceRequestId: id,
        actorUserId: input.actorUserId,
        type: 'STATUS_CHANGED',
        title: EVENT_TITLES.STATUS_CHANGED,
        metadata: { from: input.previousStatus, to: input.status },
      });
      return request;
    });
  }

  private listWhere(input: ServiceRequestListFilters): Prisma.ServiceRequestWhereInput {
    const dateRange = (from?: Date, to?: Date) => ({
      ...(from === undefined ? {} : { gte: from }),
      ...(to === undefined ? {} : { lte: to }),
    });
    return {
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.customerId === undefined ? {} : { customerId: input.customerId }),
      ...(input.serviceId === undefined ? {} : { serviceId: input.serviceId }),
      ...(input.createdFrom === undefined && input.createdTo === undefined
        ? {}
        : { createdAt: dateRange(input.createdFrom, input.createdTo) }),
      ...(input.preferredDateFrom === undefined && input.preferredDateTo === undefined
        ? {}
        : { preferredDate: dateRange(input.preferredDateFrom, input.preferredDateTo) }),
      ...(input.search === undefined
        ? {}
        : {
            OR: [
              { description: { contains: input.search, mode: 'insensitive' } },
              { address: { contains: input.search, mode: 'insensitive' } },
              { city: { contains: input.search, mode: 'insensitive' } },
              { customer: { name: { contains: input.search, mode: 'insensitive' } } },
              { customer: { phone: { contains: input.search } } },
              { service: { name: { contains: input.search, mode: 'insensitive' } } },
            ],
          }),
    };
  }
}

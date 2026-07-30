export const SERVICE_NAME_MIN_LENGTH = 3;
export const SERVICE_NAME_MAX_LENGTH = 120;
export const SERVICE_DESCRIPTION_MAX_LENGTH = 1_000;
export const SERVICE_DEFAULT_LIMIT = 20;
export const SERVICE_MAX_LIMIT = 100;
export const SERVICE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ServiceEntity {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateServiceInput {
  name: string;
  slug: string;
  description: string;
  category: string;
}

export interface UpdateServiceInput {
  name?: string;
  slug?: string;
  description?: string;
  category?: string;
  isActive?: boolean;
}

export type ServiceOrderBy = 'name' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface ListServicesInput {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  isActive?: boolean;
  orderBy: ServiceOrderBy;
  sortOrder: SortOrder;
}

export interface ServiceListResult {
  data: ServiceEntity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

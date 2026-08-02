export const CUSTOMER_NAME_MIN_LENGTH = 2;
export const CUSTOMER_NAME_MAX_LENGTH = 120;
export const CUSTOMER_DEFAULT_LIMIT = 20;
export const CUSTOMER_MAX_LIMIT = 100;

export interface CustomerEntity {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  email?: string | null;
}

export interface CreateCustomerData {
  name: string;
  phone: string;
  email: string | null;
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string;
  email?: string | null;
  isActive?: boolean;
}

export type UpdateCustomerData = UpdateCustomerInput;
export type CustomerSortBy = 'name' | 'createdAt' | 'updatedAt';
export type CustomerSortOrder = 'asc' | 'desc';

export interface ListCustomersInput {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  sortBy: CustomerSortBy;
  sortOrder: CustomerSortOrder;
}

export interface CustomerListResult {
  data: CustomerEntity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

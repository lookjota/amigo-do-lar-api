import { describe, expect, it } from 'vitest';

import {
  normalizeCustomerEmail,
  normalizeCustomerName,
  normalizeCustomerPhone,
} from './customers.service.js';

describe('customer normalization', () => {
  it('normalizes formatted Brazilian phones', () => {
    expect(normalizeCustomerPhone('(61) 99999-9999')).toBe('61999999999');
    expect(normalizeCustomerPhone('61 99999-9999')).toBe('61999999999');
  });

  it('rejects phones without 10 or 11 digits', () => {
    expect(() => normalizeCustomerPhone('12345')).toThrowError(
      expect.objectContaining({ code: 'INVALID_CUSTOMER_PHONE' }),
    );
    expect(() => normalizeCustomerPhone('phone 61999999999')).toThrowError(
      expect.objectContaining({ code: 'INVALID_CUSTOMER_PHONE' }),
    );
  });

  it('normalizes email and converts an empty value to null', () => {
    expect(normalizeCustomerEmail('  JOAO@Example.COM ')).toBe(
      'joao@example.com',
    );
    expect(normalizeCustomerEmail('   ')).toBeNull();
  });

  it('removes excess whitespace from names', () => {
    expect(normalizeCustomerName('  João   da Silva  ')).toBe('João da Silva');
  });
});

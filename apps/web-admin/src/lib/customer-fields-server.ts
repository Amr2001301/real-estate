import { cache } from 'react';
import { api, safe } from './api';
import type { CustomerFieldDef } from './customer-fields';

/** The company's own customer fields, in order; empty when they cannot be read. */
export const getCustomerFields = cache(async (): Promise<CustomerFieldDef[]> => {
  const res = await safe(api.get<CustomerFieldDef[]>('/customer-fields'));
  return res.data ?? [];
});

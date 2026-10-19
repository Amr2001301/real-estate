'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface CompanyContact {
  phone: string | null;
  whatsapp: string | null;
}

const CompanyContactContext = createContext<CompanyContact>({ phone: null, whatsapp: null });

/**
 * The tenant's contact numbers (branding → contactPhone / contactWhatsApp),
 * resolved once in the root layout. The WhatsApp button pointed at one
 * hard-coded number for every company on the platform (F37).
 */
export function CompanyContactProvider({
  contact,
  children,
}: {
  contact: CompanyContact;
  children: ReactNode;
}) {
  return (
    <CompanyContactContext.Provider value={contact}>{children}</CompanyContactContext.Provider>
  );
}

export function useCompanyContact(): CompanyContact {
  return useContext(CompanyContactContext);
}

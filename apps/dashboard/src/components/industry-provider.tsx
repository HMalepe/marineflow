'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { isRetailIndustry } from '@/lib/dashboard-nav';

type IndustryContextValue = {
  industry: string | null;
  /** Retail tenants (dispensary) sell products and take orders — never bookings. */
  retail: boolean;
};

const IndustryContext = createContext<IndustryContextValue>({ industry: null, retail: false });

export function IndustryProvider({
  industry,
  children,
}: {
  industry: string | null;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ industry, retail: isRetailIndustry(industry) }),
    [industry],
  );
  return <IndustryContext.Provider value={value}>{children}</IndustryContext.Provider>;
}

export function useIndustry(): IndustryContextValue {
  return useContext(IndustryContext);
}

/** Pick retail or salon wording at a call site. */
export function useVocab<T>(retailValue: T, salonValue: T): T {
  return useIndustry().retail ? retailValue : salonValue;
}

import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { CustomerDetailClient } from './customer-detail-client';

interface CustomerDetail {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  waId: string | null;
  marketingConsentStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  marketingConsentAt: string | null;
  noShowCount: number;
  bookingCount: number;
  noShowRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  loyaltyStamps: number;
  lifetimeValueCents: number;
  appointments: {
    id: string;
    start: string;
    status: string;
    serviceName: string;
    staffName: string;
  }[];
  messages: {
    id: string;
    direction: 'INBOUND' | 'OUTBOUND';
    body: string;
    createdAt: string;
  }[];
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const token = await getToken();
  const { id } = await params;

  let customer: CustomerDetail | null = null;
  try {
    customer = await apiFetch<CustomerDetail>(`/customers/${id}`, {}, token);
  } catch {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive font-medium">Customer not found</p>
        <p className="text-sm text-muted-foreground mt-1">The customer may have been deleted.</p>
      </div>
    );
  }

  return <CustomerDetailClient customer={customer} />;
}

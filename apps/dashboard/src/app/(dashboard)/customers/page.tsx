import { getToken } from '@/lib/auth';
import { CustomersClient } from './customers-client';

export const metadata = { title: 'Customers — MarineFlow' };

export default async function CustomersPage() {
  const token = await getToken();
  return <CustomersClient token={token ?? ''} />;
}

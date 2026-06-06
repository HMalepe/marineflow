import { getToken } from '@/lib/auth';
import { ServicesClient } from './services-client';

export default async function ServicesPage() {
  const token = await getToken();
  return <ServicesClient token={token ?? ''} />;
}

import { getToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BusinessDetailClient } from './business-detail-client';

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = await getToken();
  if (!token) redirect('/login');

  return <BusinessDetailClient businessId={id} token={token} />;
}

import { getToken } from '@/lib/auth';
import { FaqsClient } from './faqs-client';

export default async function FaqsPage() {
  const token = await getToken();
  return <FaqsClient token={token ?? ''} />;
}

import type { Metadata } from 'next';
import { getToken } from '@/lib/auth';
import { WhatsappTemplatesClient } from './whatsapp-templates-client';

export const metadata: Metadata = {
  title: 'WhatsApp Templates · MarineFlow',
  description: 'Manage Meta-approved WhatsApp rich card templates for marketing campaigns',
};

export default async function WhatsappTemplatesPage() {
  const token = await getToken();
  return <WhatsappTemplatesClient token={token ?? ''} />;
}

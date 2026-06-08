import type { Metadata } from 'next';
import { getToken } from '@/lib/auth';
import { CampaignsClient } from './campaigns-client';

export const metadata: Metadata = {
  title: 'WhatsApp Newsletter · MarineFlow',
  description: 'Send rich WhatsApp newsletters with photos, videos, and emojis to opted-in customers',
};

export default async function CampaignsPage() {
  const token = await getToken();
  return <CampaignsClient token={token ?? ''} />;
}

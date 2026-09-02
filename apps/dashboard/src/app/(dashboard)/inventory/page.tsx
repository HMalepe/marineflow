import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { InventoryClient, type InventorySku } from './inventory-client';

export default async function InventoryPage() {
  const token = (await getToken()) ?? '';
  let services: InventorySku[] = [];
  try {
    if (token) {
      const data = await apiFetch<{ services: InventorySku[] }>('/services', {}, token);
      services = data.services ?? [];
    }
  } catch {
    services = [];
  }
  return <InventoryClient token={token} initialServices={services} />;
}

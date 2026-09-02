import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { OrdersClient, type RetailOrderRow } from './orders-client';

export default async function OrdersPage() {
  const token = (await getToken()) ?? '';
  let orders: RetailOrderRow[] = [];
  try {
    if (token) {
      const data = await apiFetch<{ orders: RetailOrderRow[] }>('/retail-orders', {}, token);
      orders = data.orders ?? [];
    }
  } catch {
    orders = [];
  }

  return <OrdersClient token={token} initialOrders={orders} />;
}

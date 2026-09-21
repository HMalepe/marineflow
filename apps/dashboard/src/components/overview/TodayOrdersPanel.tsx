import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { OverviewCollapsibleSection } from './OverviewCollapsibleSection';
import { overviewNeonBox } from './overviewNeon';

export interface TodayRetailOrder {
  id: string;
  status: string;
  fulfillment: 'DELIVERY' | 'COLLECTION';
  totalCents: number;
  createdAt: string;
  items: { id: string; nameSnapshot: string; quantity: number }[];
  customer: {
    displayName: string | null;
    firstName?: string | null;
    lastName?: string | null;
    waId: string;
  };
}

function customerLabel(c: TodayRetailOrder['customer']): string {
  if (c.displayName?.trim()) return c.displayName;
  const parts = [c.firstName, c.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return c.waId;
}

/** Matches the order reference the WhatsApp bot sends the customer. */
function orderRef(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}

function formatZar(cents: number): string {
  return `R${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function itemSummary(items: TodayRetailOrder['items']): string {
  if (items.length === 0) return 'No items';
  return items.map((i) => `${i.nameSnapshot} ×${i.quantity}`).join(', ');
}

function statusLabel(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    PENDING_PAYMENT: {
      label: 'Awaiting payment',
      className:
        'bg-orange-500/15 text-orange-900 border-2 border-orange-500/45 dark:text-orange-200 font-semibold',
    },
    PAID: {
      label: 'Paid',
      className:
        'bg-emerald-500/15 text-emerald-900 border-2 border-emerald-500/45 dark:text-emerald-200 font-semibold',
    },
    PREPARING: {
      label: 'Preparing',
      className:
        'bg-amber-500/15 text-amber-900 border-2 border-amber-500/45 dark:text-amber-200 font-semibold',
    },
    OUT_FOR_DELIVERY: {
      label: 'Out for delivery',
      className:
        'bg-sky-500/15 text-sky-900 border-2 border-sky-500/45 dark:text-sky-200 font-semibold',
    },
    READY_FOR_COLLECTION: {
      label: 'Ready for collection',
      className:
        'bg-violet-500/15 text-violet-900 border-2 border-violet-500/45 dark:text-violet-200 font-semibold',
    },
    COMPLETED: {
      label: 'Completed',
      className: 'bg-muted text-muted-foreground border-2 border-border font-semibold',
    },
  };
  return (
    map[status] ?? {
      label: status.replace(/_/g, ' ').toLowerCase(),
      className: 'bg-muted text-muted-foreground border-2 border-border font-semibold',
    }
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

export function TodayOrdersPanel({
  orders,
  error,
}: {
  orders: TodayRetailOrder[];
  error: string | null;
}) {
  const todayHeading = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const awaitingPaymentCount = orders.filter((o) => o.status === 'PENDING_PAYMENT').length;

  return (
    <OverviewCollapsibleSection
      id="overview-today"
      label="Orders"
      title="Today's orders"
      subtitle={`${orders.length} placed today · ${todayHeading}`}
      actionCount={error ? 1 : awaitingPaymentCount}
      actionBadgeText={error ? 'error' : 'awaiting pay'}
      actionSeverity={error ? 'critical' : 'warning'}
      actionLabel={
        error
          ? 'Could not load today’s orders'
          : awaitingPaymentCount > 0
            ? `${awaitingPaymentCount} order${awaitingPaymentCount === 1 ? '' : 's'} awaiting payment`
            : undefined
      }
      trailing={
        <Link href="/orders" className="text-sm font-bold text-primary hover:underline shrink-0">
          Open orders →
        </Link>
      }
    >
      {error && <p className="text-sm text-destructive font-medium">{error}</p>}

      {!error && orders.length === 0 && (
        <div className={overviewNeonBox('violet', 'px-6 py-10 text-center')}>
          <ShoppingBag className="size-8 text-violet-500/50 mx-auto mb-2" />
          <p className="text-sm font-bold">No orders today</p>
          <p className="text-xs text-muted-foreground mt-2 pt-2 border-t-2 border-violet-500/20 font-medium">
            Orders land here as soon as customers check out on WhatsApp.
          </p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => {
            const status = statusLabel(order.status);
            return (
              <div key={order.id} className={overviewNeonBox('violet', 'p-4')}>
                <div className="flex items-center justify-between gap-2 pb-2 border-b-2 border-violet-500/30">
                  <p className="text-[11px] font-bold text-violet-800/80 dark:text-violet-200/90 tabular-nums">
                    {formatTime(order.createdAt)} · {orderRef(order.id)}
                  </p>
                  <p className="text-[11px] font-bold tabular-nums">{formatZar(order.totalCents)}</p>
                </div>
                <p className="font-bold text-sm mt-3 leading-snug line-clamp-2">
                  {itemSummary(order.items)}
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-2 pt-2 border-t-2 border-violet-500/15 truncate">
                  {customerLabel(order.customer)} ·{' '}
                  {order.fulfillment === 'COLLECTION' ? 'Collection' : 'Delivery'}
                </p>
                <Badge variant="outline" className={cn('mt-3 text-[10px]', status.className)}>
                  {status.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </OverviewCollapsibleSection>
  );
}

/**
 * Human wording for retail (dispensary) order statuses.
 *
 * Shared by the Orders page and the overview "Today's orders" panel so the same status
 * never reads "OUT FOR DELIVERY" in one place and "Out for delivery" in another.
 */
export const RETAIL_ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_PAYMENT: 'Awaiting payment',
  PAID: 'Paid',
  PREPARING: 'Preparing',
  OUT_FOR_DELIVERY: 'Out for delivery',
  READY_FOR_COLLECTION: 'Ready for collection',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export function retailOrderStatusLabel(status: string): string {
  return RETAIL_ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, ' ').toLowerCase();
}

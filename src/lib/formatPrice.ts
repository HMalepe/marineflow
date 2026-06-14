/** ZAR amount from dashboard service priceCents (always 2 decimal places). */
export function formatCentsZar(cents: number): string {
  return `R ${(cents / 100).toFixed(2)}`;
}

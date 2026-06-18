export const RATE_WA_MAX_PER_MIN = 30;
export const RATE_SALON_MAX_PER_MIN = 200;

export function checkBotRateLimits(waCount: number, salonCount: number): boolean {
  return waCount <= RATE_WA_MAX_PER_MIN && salonCount <= RATE_SALON_MAX_PER_MIN;
}

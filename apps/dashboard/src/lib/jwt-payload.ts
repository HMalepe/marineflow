/** Edge- and Node-safe JWT payload read (no signature verification). */
export function readJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json =
      typeof atob !== 'undefined'
        ? atob(padded)
        : Buffer.from(part, 'base64url').toString();
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string): boolean {
  const payload = readJwtPayload(token);
  if (!payload) return true;
  const exp = payload.exp;
  return typeof exp === 'number' && exp * 1000 < Date.now();
}

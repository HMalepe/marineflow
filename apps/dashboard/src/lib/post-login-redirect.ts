/** Safe internal path to send the user after login (blocks open redirects). */
export function sanitizePostLoginRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.trim();
  if (!path.startsWith('/')) return null;
  if (path.startsWith('//')) return null;
  if (path.includes(':')) return null;
  if (path.includes('\\')) return null;
  if (path.includes('..')) return null;
  if (path === '/login' || path.startsWith('/login?') || path.startsWith('/login/')) return null;
  return path;
}

export function postLoginDestination(redirectPath: string | null | undefined): string {
  return sanitizePostLoginRedirect(redirectPath) ?? '/';
}

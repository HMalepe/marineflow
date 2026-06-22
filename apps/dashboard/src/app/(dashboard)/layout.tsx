import { getToken, getUser } from '@/lib/auth';
import { getImpersonationActive } from '@/app/(dashboard)/admin/actions';
import { apiFetch } from '@/lib/api';
import { API_MISCONFIGURED_MESSAGE, isApiMisconfiguredForProduction } from '@/lib/api-config';
import {
  getDashboardDebugEnvSnapshot,
  isDashboardDebugEnabled,
} from '@/lib/dashboard-debug';
import { withDashboardDebugCatch } from '@/lib/with-dashboard-debug-catch';
import { redirect } from 'next/navigation';
import { LogoutButton, LogoutIconButton } from './logout-button';
import { MobileNav } from './mobile-nav';
import { NavLinks } from './nav-links';
import { DashboardSearch } from '@/components/dashboard-search';
import { DashboardStickyHeader } from '@/components/dashboard-sticky-header';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { ThemeToggle } from '@/components/theme-toggle';
import { DashboardDebugBanner } from '@/components/dashboard-debug-banner';

function formatRole(role: string): string {
  return role
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return withDashboardDebugCatch('(dashboard)/layout.tsx', () =>
    DashboardLayoutInner({ children })
  );
}

async function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isApiMisconfiguredForProduction()) {
    const env = isDashboardDebugEnabled() ? getDashboardDebugEnvSnapshot() : null;
    return (
      <div className="min-h-dvh flex items-center justify-center p-8">
        <div className="max-w-lg text-center space-y-3">
          <h1 className="text-xl font-bold">Dashboard configuration error</h1>
          <p className="text-sm text-muted-foreground">{API_MISCONFIGURED_MESSAGE}</p>
          {env && (
            <pre className="text-left text-xs font-mono rounded border p-3 bg-muted/50 overflow-x-auto">
              {JSON.stringify(env, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  }

  const user = await getUser();
  if (!user) redirect('/login');

  const impersonating = await getImpersonationActive();

  const token = await getToken();
  const ownerName = user.name?.trim() || user.email;
  const businessName = user.businessName?.trim() || 'Your business';
  let logoUrl: string | null = null;
  try {
    if (token && (user.role === 'OWNER' || user.role === 'MANAGER')) {
      const data = await apiFetch<{ salon: { logoUrl: string | null } }>('/settings', {}, token);
      logoUrl = data.salon.logoUrl ?? null;
    }
  } catch {
    // logo is optional — sidebar still works without it
  }

  const isOwner = user.role === 'OWNER';
  const isAdmin = user.role === 'SUPER_ADMIN';

  let handoffCount = 0;
  try {
    if (token && !isAdmin) {
      const hd = await apiFetch<{ count: number }>('/conversations/handoff-count', {}, token);
      handoffCount = hd.count ?? 0;
    }
  } catch {
    // badge is non-critical
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {isDashboardDebugEnabled() && <DashboardDebugBanner />}
      {impersonating && <ImpersonationBanner businessName={businessName} />}
      <div className="min-h-dvh flex flex-col md:flex-row flex-1">
      {/* Mobile header + bottom nav */}
      <MobileNav
        isAdmin={isAdmin}
        isOwner={isOwner}
        businessName={businessName}
        logoUrl={logoUrl}
        handoffCount={handoffCount}
      />

      {/* Sidebar (desktop only) — pinned to viewport while main content scrolls */}
      <aside className="dashboard-sidebar-shell w-64 shrink-0 hidden md:flex md:flex-col md:sticky md:top-0 md:h-dvh md:overflow-hidden">

        {/* Business identity */}
        <div className="shrink-0 px-4 py-4 border-b flex items-center gap-3">
          {/* Logo / initials avatar — white bg keeps dark logos visible */}
          <div className={`shrink-0 size-10 rounded-xl overflow-hidden flex items-center justify-center border border-border/70 shadow-[var(--solupair-glass-highlight-subtle)] ${logoUrl ? 'bg-white' : 'bg-muted/80'}`}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={businessName} loading="eager" decoding="async" className="size-full object-contain p-1" />
            ) : (
              <span className="text-sm font-bold text-muted-foreground select-none">
                {businessName.split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('')}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 leading-none mb-0.5">
              {formatRole(user.role)}
            </p>
            <p className="text-sm font-bold leading-tight truncate">{businessName}</p>
            <div className="flex items-center gap-0.5 mt-0.5 min-w-0">
              <p className="text-[11px] text-muted-foreground leading-tight truncate flex-1 min-w-0">
                {ownerName}
              </p>
              <ThemeToggle />
              <LogoutIconButton />
            </div>
            {user.phone && (
              <p className="text-[10px] text-muted-foreground/70 mt-0.5 tabular-nums">{user.phone}</p>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="shrink-0 px-3 pt-3">
          <DashboardSearch isAdmin={isAdmin} isOwner={isOwner} />
        </div>

        {/* Nav — scrolls independently inside the fixed sidebar */}
        <nav className="flex-1 min-h-0 p-3 overflow-y-auto overscroll-contain space-y-0.5">
          <NavLinks isAdmin={isAdmin} isOwner={isOwner} handoffCount={handoffCount} />
        </nav>

        {/* Product watermark */}
        <div className="shrink-0 px-5 py-3 border-t border-b">
          <div className="flex items-center gap-2">
            {/* WhatsApp-green pulse dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full solupair-brand-pulse opacity-50" />
              <span className="relative inline-flex rounded-full h-2 w-2 solupair-brand-pulse" />
            </span>
            <div>
              <p className="text-[13px] font-bold leading-none tracking-tight solupair-text-gradient">
                Solupair
              </p>
              <p className="text-[10px] text-muted-foreground/80 leading-tight mt-0.5 tracking-wide">
                MarineFlow · WhatsApp
              </p>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="shrink-0 p-4">
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="dashboard-main-shell flex-1 min-w-0 min-h-dvh flex flex-col">
        <DashboardStickyHeader isAdmin={isAdmin} isOwner={isOwner} handoffCount={handoffCount} />
        <div className="flex-1 p-4 pb-mobile-main md:p-8 min-w-0 overflow-x-clip">
          {children}
        </div>
      </main>
      </div>
    </div>
  );
}

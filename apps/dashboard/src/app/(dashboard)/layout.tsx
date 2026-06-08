import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { redirect } from 'next/navigation';
import { LogoutButton } from './logout-button';

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
  const user = await getUser();
  if (!user) redirect('/login');

  const token = await getToken();
  let businessName = user.name;
  let logoUrl: string | null = null;
  try {
    if (token) {
      const data = await apiFetch<{ salon: { displayName: string } }>('/me', {}, token);
      businessName = data.salon.displayName;
    }
  } catch {
    // fall back to JWT name
  }
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

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col">

        {/* Business identity */}
        <div className="px-4 py-4 border-b flex items-center gap-3">
          {/* Logo / initials avatar */}
          <div className="shrink-0 size-10 rounded-xl overflow-hidden bg-muted flex items-center justify-center border">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={businessName} className="size-full object-contain p-0.5" />
            ) : (
              <span className="text-sm font-bold text-muted-foreground select-none">
                {businessName.split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('')}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 leading-none mb-1">
              {formatRole(user.role)}
            </p>
            <p className="text-sm font-bold leading-tight truncate">{businessName}</p>
            {user.phone && (
              <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{user.phone}</p>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {isAdmin ? (
            <>
              <NavLink href="/">Overview</NavLink>
              <NavLink href="/agency">Salons</NavLink>
              <NavLink href="/admin">Admin</NavLink>
              <NavLink href="/analytics">Analytics</NavLink>
              <NavLink href="/billing">Billing</NavLink>
            </>
          ) : (
            <>
              <NavLink href="/">Overview</NavLink>
              <NavLink href="/appointments">Appointments</NavLink>
              <NavLink href="/customers">Customers</NavLink>
              <NavLink href="/campaigns">Newsletter</NavLink>
              <NavLink href="/conversations">Conversations</NavLink>
              <NavLink href="/analytics">Analytics</NavLink>
              <NavLink href="/staff">Staff</NavLink>
              <NavLink href="/services">Services</NavLink>
              <NavLink href="/faqs">Bot FAQs</NavLink>
              {isOwner && <NavLink href="/billing">Billing</NavLink>}
              {isOwner && <NavLink href="/settings">Settings</NavLink>}
            </>
          )}
        </nav>

        {/* Product watermark */}
        <div className="px-5 py-3 border-t border-b">
          <div className="flex items-center gap-2">
            {/* WhatsApp-green pulse dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#25d366] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#25d366]" />
            </span>
            <div>
              <p
                className="text-[13px] font-bold leading-none tracking-tight"
                style={{
                  background: 'linear-gradient(90deg, #25d366 0%, #128c7e 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                MarineFlow
              </p>
              <p className="text-[10px] text-muted-foreground/80 leading-tight mt-0.5 tracking-wide">
                WhatsApp Chatbot
              </p>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="p-4">
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 md:p-8 bg-muted/30">
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      {children}
    </Link>
  );
}

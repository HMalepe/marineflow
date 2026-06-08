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
  try {
    if (token) {
      const data = await apiFetch<{ salon: { displayName: string } }>('/me', {}, token);
      businessName = data.salon.displayName;
    }
  } catch {
    // Fall back to JWT name if API unavailable
  }

  const isOwner = user.role === 'OWNER';
  const isAdmin = user.role === 'SUPER_ADMIN';

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold">MarineFlow</h1>
          <p className="text-sm font-semibold mt-2 leading-tight">{businessName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatRole(user.role)}</p>
          {user.phone && (
            <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{user.phone}</p>
          )}
        </div>
        <nav className="flex-1 p-4 space-y-1">
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
        <div className="p-4 border-t">
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

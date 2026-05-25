import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LogoutButton } from './logout-button';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold">MarineFlow</h1>
          <p className="text-xs text-muted-foreground mt-1">{user.name}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavLink href="/">Overview</NavLink>
          <NavLink href="/appointments">Appointments</NavLink>
          <NavLink href="/customers">Customers</NavLink>
          <NavLink href="/analytics">Analytics</NavLink>
          <NavLink href="/staff">Staff</NavLink>
          <NavLink href="/branches">Branches</NavLink>
          <NavLink href="/billing">Billing</NavLink>
          <NavLink href="/admin">Admin</NavLink>
          <NavLink href="/settings">Settings</NavLink>
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

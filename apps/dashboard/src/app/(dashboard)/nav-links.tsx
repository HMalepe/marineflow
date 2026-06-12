'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavLinksProps {
  isAdmin: boolean;
  isOwner: boolean;
}

export function NavLinks({ isAdmin, isOwner }: NavLinksProps) {
  const pathname = usePathname();

  function active(href: string) {
    if (href === '/') return pathname === '/';
    if (href === '/roster') return pathname.startsWith('/roster') || pathname.startsWith('/staff');
    return pathname.startsWith(href);
  }

  const cls = (href: string) =>
    cn(
      'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
      active(href)
        ? 'bg-accent text-accent-foreground font-semibold'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    );

  if (isAdmin) {
    return (
      <>
        <Link href="/" className={cls('/')}>Overview</Link>
        <Link href="/agency" className={cls('/agency')}>Salons</Link>
        <Link href="/admin" className={cls('/admin')}>Admin</Link>
        <Link href="/analytics" className={cls('/analytics')}>Analytics</Link>
        <Link href="/billing" className={cls('/billing')}>Billing</Link>
      </>
    );
  }

  return (
    <>
      <Link href="/" className={cls('/')}>Overview</Link>
      <Link href="/appointments" className={cls('/appointments')}>Appointments</Link>
      <Link href="/customers" className={cls('/customers')}>Customers</Link>
      <Link href="/campaigns" className={cls('/campaigns')}>Newsletter</Link>
      <Link href="/automations" className={cls('/automations')}>Power Features</Link>
      <Link href="/team-performance" className={cls('/team-performance')}>Team Performance</Link>
      <Link href="/conversations" className={cls('/conversations')}>Conversations</Link>
      <Link href="/tickets" className={cls('/tickets')}>Tickets</Link>
      <Link href="/analytics" className={cls('/analytics')}>Analytics</Link>
      <Link href="/roster" className={cls('/roster')}>Staff Roster</Link>
      <Link href="/services" className={cls('/services')}>Services</Link>
      <Link href="/faqs" className={cls('/faqs')}>Bot FAQs</Link>
      {isOwner && <Link href="/billing" className={cls('/billing')}>Billing</Link>}
      {isOwner && <Link href="/settings" className={cls('/settings')}>Settings</Link>}
    </>
  );
}

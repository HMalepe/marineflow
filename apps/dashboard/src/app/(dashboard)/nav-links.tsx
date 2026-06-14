'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavLinksProps {
  isAdmin: boolean;
  isOwner: boolean;
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 select-none">
        {label}
      </p>
      {children}
    </div>
  );
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
      'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
      active(href)
        ? 'bg-primary/10 text-primary font-semibold'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    );

  if (isAdmin) {
    return (
      <div className="space-y-4">
        <NavSection label="Platform">
          <Link href="/" className={cls('/')}>Overview</Link>
          <Link href="/agency" className={cls('/agency')}>Salons</Link>
          <Link href="/admin" className={cls('/admin')}>Admin</Link>
        </NavSection>
        <NavSection label="Reports">
          <Link href="/analytics" className={cls('/analytics')}>Analytics</Link>
          <Link href="/billing" className={cls('/billing')}>Billing</Link>
        </NavSection>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/" className={cls('/')}>Overview</Link>

      <NavSection label="Bookings">
        <Link href="/appointments" className={cls('/appointments')}>Appointments</Link>
        <Link href="/roster" className={cls('/roster')}>Staff Roster</Link>
        <Link href="/conversations" className={cls('/conversations')}>Conversations</Link>
        <Link href="/tickets" className={cls('/tickets')}>Tickets</Link>
      </NavSection>

      <NavSection label="Customers">
        <Link href="/customers" className={cls('/customers')}>Customers</Link>
        <Link href="/campaigns" className={cls('/campaigns')}>Newsletter</Link>
      </NavSection>

      <NavSection label="Business">
        <Link href="/services" className={cls('/services')}>Services</Link>
        <Link href="/faqs" className={cls('/faqs')}>Bot FAQs</Link>
        <Link href="/analytics" className={cls('/analytics')}>Analytics</Link>
        <Link href="/team-performance" className={cls('/team-performance')}>Team</Link>
        <Link href="/automations" className={cls('/automations')}>Power Features</Link>
      </NavSection>

      {isOwner && (
        <NavSection label="Account">
          <Link href="/billing" className={cls('/billing')}>Billing</Link>
          <Link href="/settings" className={cls('/settings')}>Settings</Link>
        </NavSection>
      )}
    </div>
  );
}

import type React from 'react';

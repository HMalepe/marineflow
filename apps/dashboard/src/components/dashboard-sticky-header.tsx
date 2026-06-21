'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { PageSectionNav } from '@/components/page-section-nav';

interface Props {
  isAdmin: boolean;
  isOwner: boolean;
  handoffCount?: number;
}

export function DashboardStickyHeader({ isAdmin }: Props) {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const syncOffset = () => {
      document.documentElement.style.setProperty('--dashboard-sticky-offset', `${el.offsetHeight}px`);
    };

    syncOffset();
    const observer = new ResizeObserver(syncOffset);
    observer.observe(el);
    window.addEventListener('resize', syncOffset);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncOffset);
      document.documentElement.style.removeProperty('--dashboard-sticky-offset');
    };
  }, [pathname]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 shadow-[0_1px_0_rgb(0_0_0/0.04),0_8px_20px_-16px_rgb(0_0_0/0.12)]"
    >
      <PageSectionNav isAdmin={isAdmin} />
    </header>
  );
}

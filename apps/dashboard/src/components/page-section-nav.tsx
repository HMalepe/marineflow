'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { scrollToPageSection } from '@/lib/page-section-scroll';
import { pageTitleForPath } from '@/lib/dashboard-nav';
import { cn } from '@/lib/utils';

export type PageSectionLink = { id: string; label: string };

function collectPageSections(): PageSectionLink[] {
  const main = document.querySelector('main');
  if (!main) return [];

  const nodes = main.querySelectorAll<HTMLElement>('.dashboard-section-anchor[id]');
  const seen = new Set<string>();
  const links: PageSectionLink[] = [];

  for (const el of nodes) {
    if (!el.id || seen.has(el.id)) continue;
    seen.add(el.id);
    const label =
      el.dataset.sectionLabel?.trim() ||
      el.querySelector('h1, h2, h3, [data-slot=card-title]')?.textContent?.trim() ||
      el.id;
    if (label) links.push({ id: el.id, label });
  }

  return links;
}

function SectionPill({ id, label }: PageSectionLink) {
  return (
    <button
      type="button"
      onClick={() => scrollToPageSection(id)}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap',
        'bg-muted/80 text-muted-foreground border border-transparent',
        'hover:bg-accent hover:text-accent-foreground transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {label}
    </button>
  );
}

interface Props {
  isAdmin: boolean;
}

export function PageSectionNav({ isAdmin }: Props) {
  const pathname = usePathname();
  const [sections, setSections] = useState<PageSectionLink[]>([]);
  const pageTitle = pageTitleForPath(pathname, isAdmin);

  const rescan = useCallback(() => {
    setSections(collectPageSections());
  }, []);

  useEffect(() => {
    rescan();

    const main = document.querySelector('main');
    if (!main) return;

    const observer = new MutationObserver(() => {
      rescan();
    });
    observer.observe(main, { childList: true, subtree: true });

    const onLoad = () => rescan();
    window.addEventListener('load', onLoad);

    return () => {
      observer.disconnect();
      window.removeEventListener('load', onLoad);
    };
  }, [pathname, rescan]);

  if (sections.length === 0) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-2.5">
        <p className="text-sm font-semibold tracking-tight">{pageTitle}</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-2.5 space-y-2">
      <p className="text-sm font-semibold tracking-tight">{pageTitle}</p>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1.5">
          On this page
        </p>
        <div
          className={cn(
            'flex gap-1.5 overflow-x-auto overscroll-x-contain scrollbar-none pb-0.5',
            '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}
        >
          {sections.map((section) => (
            <SectionPill key={section.id} {...section} />
          ))}
        </div>
      </div>
    </div>
  );
}

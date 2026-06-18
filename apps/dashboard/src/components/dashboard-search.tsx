'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  localDashboardSearch,
  visibleSearchEntries,
  type DashboardSearchResult,
} from '@/lib/dashboard-search';
import { searchDashboardAction } from '@/lib/dashboard-search-action';

interface Props {
  isAdmin: boolean;
  isOwner: boolean;
  /** compact = icon-only trigger for mobile header */
  variant?: 'default' | 'compact';
}

export function DashboardSearch({ isAdmin, isOwner, variant = 'default' }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [interpretedAs, setInterpretedAs] = useState<string | undefined>();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [aiUsed, setAiUsed] = useState(false);
  const [pending, startTransition] = useTransition();

  const entries = useMemo(
    () => visibleSearchEntries({ isAdmin, isOwner }),
    [isAdmin, isOwner],
  );

  const localResults = useMemo(
    () => localDashboardSearch(query, entries, 8),
    [query, entries],
  );

  const [results, setResults] = useState<DashboardSearchResult[]>(localResults);

  useEffect(() => {
    setResults(localResults);
    setActiveIndex(0);
  }, [localResults]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const runAiSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed.length < 2) {
        setInterpretedAs(undefined);
        setSuggestions([]);
        setAiUsed(false);
        return;
      }

      startTransition(async () => {
        const res = await searchDashboardAction(trimmed, { isAdmin, isOwner });
        setResults(res.results.length ? res.results : localDashboardSearch(trimmed, entries, 8));
        setInterpretedAs(res.interpretedAs);
        setSuggestions(res.suggestions);
        setAiUsed(res.aiUsed);
        setActiveIndex(0);
      });
    },
    [entries],
  );

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => runAiSearch(query), 350);
    return () => window.clearTimeout(handle);
  }, [open, query, runAiSearch]);

  function closeAndNavigate(href: string) {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      closeAndNavigate(results[activeIndex]!.href);
    }
  }

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-input bg-background text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
        variant === 'compact'
          ? 'size-9 justify-center shrink-0'
          : 'w-full px-3 py-2',
      )}
      aria-label="Search dashboard"
    >
      <Search className="size-4 shrink-0" />
      {variant === 'default' && (
        <>
          <span className="flex-1 text-left truncate">Search pages & settings…</span>
          <kbd className="hidden lg:inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            Ctrl K
          </kbd>
        </>
      )}
    </button>
  );

  return (
    <>
      {trigger}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh] sm:pt-[15vh]">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
            aria-label="Close search"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Dashboard search"
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search roster, FAQ, newsletter, settings…"
                className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                autoComplete="off"
                spellCheck={false}
              />
              {pending && (
                <span className="text-[10px] text-muted-foreground shrink-0">Matching…</span>
              )}
            </div>

            <div className="max-h-[min(50vh,420px)] overflow-y-auto p-2">
              {interpretedAs && (
                <p className="px-2 pb-2 text-xs text-muted-foreground">
                  {aiUsed ? 'Understood as' : 'Showing results for'}:{' '}
                  <span className="font-medium text-foreground">{interpretedAs}</span>
                </p>
              )}

              {results.length === 0 ? (
                <p className="px-3 py-6 text-sm text-center text-muted-foreground">
                  No matches — try “staff”, “faq”, “hours”, or “newsletter”
                </p>
              ) : (
                <ul className="space-y-1">
                  {results.map((item, idx) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => closeAndNavigate(item.href)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={cn(
                          'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                          idx === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/70',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{item.label}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{item.group}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {suggestions.length > 0 && (
              <div className="border-t px-3 py-2 flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <span
                    key={s}
                    className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            <div className="border-t px-3 py-2 text-[10px] text-muted-foreground flex items-center justify-between">
              <span>↑↓ navigate · Enter open · Esc close</span>
              {aiUsed && <span>Smart match</span>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

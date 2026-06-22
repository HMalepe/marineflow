'use client';

import { useMemo, useState } from 'react';
import { LayoutTemplate, PenLine, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type CampaignTemplateCategory =
  | 'seasonal'
  | 'holiday'
  | 'promo'
  | 'win-back'
  | 'loyalty'
  | 'new-client'
  | 'services'
  | 'flash'
  | 'thank-you';

export interface CampaignTemplate {
  id: string;
  name: string;
  category: CampaignTemplateCategory;
  description: string;
  message: string;
  suggestedMonth?: number;
  tags?: string[];
}

export const TEMPLATE_CATEGORY_LABELS: { id: CampaignTemplateCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'holiday', label: 'Holidays' },
  { id: 'promo', label: 'Promotions' },
  { id: 'win-back', label: 'Win-back' },
  { id: 'loyalty', label: 'Loyalty' },
  { id: 'new-client', label: 'New clients' },
  { id: 'services', label: 'By service' },
  { id: 'flash', label: 'Flash deals' },
  { id: 'thank-you', label: 'Thank you' },
];

function categoryLabel(id: CampaignTemplateCategory): string {
  return TEMPLATE_CATEGORY_LABELS.find((c) => c.id === id)?.label ?? id;
}

function previewSnippet(message: string): string {
  const first = message.split('\n\n')[0]?.replace(/\n/g, ' ') ?? message;
  return first.length > 72 ? `${first.slice(0, 72)}…` : first;
}

export function CampaignTemplatePicker({
  templates,
  loading,
  selectedTemplateId,
  onSelect,
  onClearSelection,
  contentTab,
  onContentTabChange,
}: {
  templates: CampaignTemplate[];
  loading?: boolean;
  selectedTemplateId: string | null;
  onSelect: (template: CampaignTemplate) => void;
  onClearSelection: () => void;
  contentTab: 'templates' | 'custom';
  onContentTabChange: (tab: 'templates' | 'custom') => void;
}) {
  const [category, setCategory] = useState<CampaignTemplateCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => (selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) : undefined),
    [selectedTemplateId, templates],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.message.toLowerCase().includes(q) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [templates, category, query]);

  const counts = useMemo(() => {
    const map = new Map<CampaignTemplateCategory | 'all', number>();
    map.set('all', templates.length);
    for (const t of templates) {
      map.set(t.category, (map.get(t.category) ?? 0) + 1);
    }
    return map;
  }, [templates]);

  return (
    <div className="space-y-3">
      <div className="flex rounded-lg border p-1 bg-muted/40">
        <button
          type="button"
          onClick={() => onContentTabChange('templates')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors',
            contentTab === 'templates'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <LayoutTemplate className="size-3.5" />
          Template library
          {!loading && (
            <span className="tabular-nums text-[10px] text-muted-foreground">({templates.length})</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onContentTabChange('custom')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors',
            contentTab === 'custom'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <PenLine className="size-3.5" />
          Write your own
        </button>
      </div>

      {selected && contentTab === 'custom' && (
        <div className="flex items-start gap-2 rounded-lg border border-[#128c7e]/30 bg-[#25d366]/5 px-3 py-2.5">
          <LayoutTemplate className="size-4 shrink-0 text-[#128c7e] mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">Using template: {selected.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{categoryLabel(selected.category)}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onContentTabChange('templates')}
            >
              Change
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              title="Remove template and clear message"
              onClick={onClearSelection}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {contentTab === 'templates' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              className="pl-8 h-9 text-sm"
            />
          </div>

          <div className="dashboard-h-scroll gap-1.5 pb-1 -mx-1 px-1 snap-x snap-mandatory">
            {TEMPLATE_CATEGORY_LABELS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={cn(
                  'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  category === cat.id
                    ? 'bg-[#128c7e] text-white border-[#128c7e]'
                    : 'hover:bg-muted text-muted-foreground',
                )}
              >
                {cat.label}
                <span className="ml-1 tabular-nums opacity-80">({counts.get(cat.id) ?? 0})</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-lg">
              No templates match — try another category or search.
            </p>
          ) : (
            <ul className="max-h-[min(42vh,320px)] overflow-y-auto space-y-2 pr-1 -mr-1">
              {filtered.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(t)}
                    className={cn(
                      'w-full text-left rounded-xl border p-3 transition-all hover:border-[#128c7e]/50 hover:bg-[#25d366]/5',
                      selectedTemplateId === t.id &&
                        'border-[#128c7e] bg-[#25d366]/5 ring-1 ring-[#128c7e]/20',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{t.name}</p>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {categoryLabel(t.category)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{t.description}</p>
                    <p className="text-[11px] text-muted-foreground/80 mt-1.5 line-clamp-2 italic">
                      {previewSnippet(t.message)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            Tap a template to use it — you can edit the message on &ldquo;Write your own&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}

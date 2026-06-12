'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  FOLLOW_UP_MESSAGE_MAX_LENGTH,
  canApplyTemplate,
  indexOfMatchingTemplate,
  isCustomMessage,
  templateLengthWarning,
} from '@/lib/follow-up-template-utils';
import type { FollowUpMessageTemplate } from './follow-up-message-templates';

interface FollowUpTemplatePickerProps {
  templates: FollowUpMessageTemplate[];
  salonName: string;
  value: string;
  onChange: (value: string) => void;
  onApplyError?: (message: string) => void;
}

export function FollowUpTemplatePicker({
  templates,
  salonName,
  value,
  onChange,
  onApplyError,
}: FollowUpTemplatePickerProps) {
  const custom = useMemo(
    () => (templates.length ? isCustomMessage(templates, value, salonName) : false),
    [templates, value, salonName],
  );

  const lengthWarning = useMemo(() => templateLengthWarning(value), [value]);

  const [index, setIndex] = useState(() =>
    templates.length ? indexOfMatchingTemplate(templates, value, salonName) : 0,
  );

  useEffect(() => {
    if (!templates.length || custom) return;
    setIndex(indexOfMatchingTemplate(templates, value, salonName));
  }, [custom, templates, value, salonName]);

  const applyAtIndex = useCallback(
    (nextIndex: number) => {
      if (!templates.length) return;
      const wrapped = ((nextIndex % templates.length) + templates.length) % templates.length;
      const template = templates[wrapped]!;
      const result = canApplyTemplate(template, salonName);
      setIndex(wrapped);
      if (result.ok) {
        onChange(result.text);
      } else {
        onApplyError?.(result.reason);
        onChange(result.text);
      }
    },
    [onApplyError, onChange, salonName, templates],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        applyAtIndex(index - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        applyAtIndex(index + 1);
      }
    },
    [applyAtIndex, index],
  );

  if (templates.length === 0) return null;

  const active = templates[index] ?? templates[0]!;

  return (
    <div className="space-y-2" onKeyDown={onKeyDown}>
      <div
        className="flex items-center gap-1.5 outline-none focus-within:ring-1 focus-within:ring-ring rounded-md"
        tabIndex={0}
        role="group"
        aria-label="Message template presets"
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Previous template"
          onClick={() => applyAtIndex(index - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>

        <div className="flex-1 min-w-0 rounded-md border bg-muted/40 px-2.5 py-1.5 text-center">
          <p className="text-xs font-medium truncate">
            {custom ? 'Custom message' : active.label}
          </p>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {index + 1} / {templates.length}
            {custom ? ' · edited' : ''}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Next template"
          onClick={() => applyAtIndex(index + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0 h-8 text-xs"
          onClick={() => applyAtIndex(index)}
        >
          Use
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {templates.map((template, i) => (
          <button
            key={template.id}
            type="button"
            onClick={() => applyAtIndex(i)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              !custom && i === index
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input bg-background text-muted-foreground',
            )}
          >
            {template.label}
          </button>
        ))}
      </div>

      {lengthWarning.over && (
        <p className="text-[11px] text-destructive font-medium">
          {lengthWarning.length} / {lengthWarning.max} characters — shorten before saving.
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        Tap a preset or use ← → (max {FOLLOW_UP_MESSAGE_MAX_LENGTH} chars) — edit below before saving.
      </p>
    </div>
  );
}

export function FollowUpCharCount({ value }: { value: string }) {
  const over = value.length > FOLLOW_UP_MESSAGE_MAX_LENGTH;
  return (
    <p
      className={cn(
        'text-xs text-right tabular-nums',
        over ? 'text-destructive font-medium' : 'text-muted-foreground',
      )}
    >
      {value.length} / {FOLLOW_UP_MESSAGE_MAX_LENGTH}
    </p>
  );
}

'use client';

import { cn } from '@/lib/utils';

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Salon',
    emojis: ['💇', '💅', '✨', '💆', '💄', '🪮', '🧴', '🌸'],
  },
  {
    label: 'Offers',
    emojis: ['🎉', '🔥', '⭐', '💝', '🎁', '💯', '🏷️', '✅'],
  },
  {
    label: 'Hearts',
    emojis: ['❤️', '💚', '🙏', '😊', '🥰', '👋', '📅', '📍'],
  },
];

interface Props {
  onInsert: (emoji: string) => void;
  className?: string;
}

export function EmojiBar({ onInsert, className }: Props) {
  return (
    <div className={cn('rounded-lg border bg-muted/30 p-2 space-y-2', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
        Add emoji
      </p>
      {EMOJI_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="text-[10px] text-muted-foreground/80 px-1 mb-1">{group.label}</p>
          <div className="flex flex-wrap gap-0.5">
            {group.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onInsert(emoji)}
                className="size-8 rounded-md text-lg hover:bg-background hover:scale-110 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

'use client';

import { type RefObject, type ReactNode } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ChatDirection = 'inbound' | 'outbound' | 'system';

export interface ChatMessage {
  id: string;
  direction: ChatDirection;
  body: string;
  createdAt: string;
  senderLabel?: string;
}

export function formatChatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatChatDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

export function groupChatMessagesByDay(messages: ChatMessage[]): Array<{ day: string; messages: ChatMessage[] }> {
  const groups: Array<{ day: string; messages: ChatMessage[] }> = [];
  for (const msg of messages) {
    const day = formatChatDayLabel(msg.createdAt);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.messages.push(msg);
    else groups.push({ day, messages: [msg] });
  }
  return groups;
}

function ChatBubble({
  message,
  showSender,
}: {
  message: ChatMessage;
  showSender: boolean;
}) {
  if (message.direction === 'system') {
    return (
      <div className="flex justify-center py-1">
        <span className="chat-day-pill text-[11px]">{message.body}</span>
      </div>
    );
  }

  const inbound = message.direction === 'inbound';

  return (
    <div className={cn('flex flex-col max-w-[min(85%,20rem)]', inbound ? 'items-start' : 'items-end ml-auto')}>
      {showSender && message.senderLabel && (
        <span className="text-[11px] text-muted-foreground mb-1 px-1">{message.senderLabel}</span>
      )}
      <div
        className={cn(
          'chat-bubble relative px-3.5 py-2 text-[15px] leading-relaxed whitespace-pre-wrap break-words',
          inbound ? 'chat-bubble-inbound' : 'chat-bubble-outbound',
        )}
      >
        {message.body}
        <span
          className={cn(
            'block text-[10px] mt-1 tabular-nums',
            inbound ? 'text-muted-foreground/80 text-right' : 'text-primary-foreground/75 text-right',
          )}
        >
          {formatChatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

interface ChatThreadProps {
  messages: ChatMessage[];
  loading?: boolean;
  emptyLabel?: string;
  scrollRef?: RefObject<HTMLDivElement | null>;
  endRef?: RefObject<HTMLDivElement | null>;
  className?: string;
}

export function ChatThread({
  messages,
  loading,
  emptyLabel = 'No messages yet',
  scrollRef,
  endRef,
  className,
}: ChatThreadProps) {
  const groups = groupChatMessagesByDay(messages);

  return (
    <div ref={scrollRef} className={cn('chat-thread flex-1 min-h-0', className)}>
      {loading && messages.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">Loading messages…</p>
      )}
      {!loading && messages.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">{emptyLabel}</p>
      )}
      <div className="chat-thread-inner space-y-4">
        {groups.map((group) => (
          <div key={group.day} className="space-y-2">
            <div className="flex justify-center py-2">
              <span className="chat-day-pill">{group.day}</span>
            </div>
            {group.messages.map((msg, i) => {
              const prev = group.messages[i - 1];
              const showSender =
                Boolean(msg.senderLabel) &&
                (!prev || prev.direction !== msg.direction || prev.senderLabel !== msg.senderLabel);
              return <ChatBubble key={msg.id} message={msg} showSender={showSender} />;
            })}
          </div>
        ))}
        <div ref={endRef} className="h-px shrink-0" aria-hidden />
      </div>
    </div>
  );
}

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  sending?: boolean;
  footer?: ReactNode;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  placeholder = 'Message…',
  disabled,
  sending,
  footer,
}: ChatComposerProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || disabled || sending) return;
    onSubmit();
  }

  return (
    <div className="chat-composer shrink-0 safe-area-pb">
      {footer}
      <form onSubmit={handleSubmit} className="chat-composer-bar">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || sending}
          autoComplete="off"
          className="chat-composer-input"
        />
        <Button
          type="submit"
          size="icon"
          disabled={disabled || sending || !value.trim()}
          className="chat-composer-send shrink-0 rounded-full size-10 touch-manipulation"
          aria-label="Send message"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

export function ChatListSectionLabel({ children }: { children: ReactNode }) {
  return <div className="chat-list-section-label">{children}</div>;
}

export function ChatEmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 p-10 min-h-[12rem]">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">{hint}</p>}
    </div>
  );
}

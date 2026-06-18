'use client';

import { cn } from '@/lib/utils';

export function avatarColor(name: string) {
  const colors = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
    'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-pink-500',
  ];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return colors[hash % colors.length]!;
}

export function staffInitials(name: string, displayName?: string | null, max = 2) {
  return (displayName ?? name)
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, max)
    .toUpperCase();
}

export function staffFirstInitial(name: string, displayName?: string | null) {
  return staffInitials(name, displayName, 1);
}

interface StaffAvatarProps {
  name: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
}

const SIZE: Record<NonNullable<StaffAvatarProps['size']>, string> = {
  xs: 'size-[18px] text-[8px]',
  sm: 'size-7 text-[10px]',
  md: 'size-9 text-sm',
  lg: 'size-12 text-base',
};

export function StaffAvatar({
  name,
  displayName,
  avatarUrl,
  size = 'md',
  className,
  title,
}: StaffAvatarProps) {
  const label = displayName ?? name;
  const letter = size === 'xs' ? staffFirstInitial(name, displayName) : staffInitials(name, displayName);

  return (
    <div
      title={title ?? label}
      className={cn(
        'rounded-full text-white flex items-center justify-center font-bold shrink-0 overflow-hidden',
        SIZE[size],
        avatarColor(name),
        className,
      )}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={label} className="w-full h-full object-cover" />
      ) : (
        letter
      )}
    </div>
  );
}

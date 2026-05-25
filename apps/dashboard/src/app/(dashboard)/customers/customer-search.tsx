'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';

export function CustomerSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  function handleSearch(value: string) {
    setQuery(value);
    startTransition(() => {
      const params = value.trim() ? `?q=${encodeURIComponent(value.trim())}` : '';
      router.push(`/customers${params}`);
    });
  }

  return (
    <div className="relative max-w-md">
      <Input
        placeholder="Search by name, email, or phone..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="pl-4"
      />
      {isPending && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DashboardPageHeader } from '@/components/dashboard-page-header';

import { resolveApiUrl } from '@/lib/api-config';

interface WebhookSub {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  description?: string;
  createdAt: string;
  _count?: { deliveries: number };
}

const AVAILABLE_EVENTS = [
  'appointment.created',
  'appointment.updated',
  'appointment.cancelled',
  'message.received',
  'customer.created',
  'payment.completed',
];

interface Props {
  token: string;
}

export function WebhooksClient({ token }: Props) {
  const [webhooks, setWebhooks] = useState<WebhookSub[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  useEffect(() => {
    fetch(resolveApiUrl('api', '/webhooks', { forBrowser: true }), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setWebhooks(d.webhooks ?? []))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch(resolveApiUrl('api', '/webhooks', { forBrowser: true }), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: form.get('url'),
        events: selectedEvents,
        description: form.get('description') || undefined,
      }),
    });
    if (res.ok) {
      const { webhook } = await res.json();
      setWebhooks([webhook, ...webhooks]);
      setShowCreate(false);
      setSelectedEvents([]);
    }
  }

  async function handleDelete(id: string) {
    await fetch(resolveApiUrl('api', `/webhooks/${id}`, { forBrowser: true }), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setWebhooks(webhooks.filter((w) => w.id !== id));
  }

  if (loading) return <p className="p-6 text-muted-foreground">Loading...</p>;

  return (
    <div className="dashboard-page-flow space-y-6">
      <DashboardPageHeader
        title="Webhooks"
        variant="violet"
        subtitle="Send real-time events to external services (Zapier, Make, custom)."
        actions={
          <Button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : '+ Add Webhook'}
          </Button>
        }
      />

      {showCreate && (
        <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-4 bg-card">
          <div className="space-y-1">
            <Label className="text-xs">Endpoint URL</Label>
            <Input name="url" type="url" placeholder="https://hooks.zapier.com/..." required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description (optional)</Label>
            <Input name="description" placeholder="e.g. Zapier booking sync" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Events</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_EVENTS.map((evt) => (
                <label
                  key={evt}
                  className={`text-xs border rounded px-2 py-1 cursor-pointer transition-colors ${
                    selectedEvents.includes(evt)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selectedEvents.includes(evt)}
                    onChange={(e) =>
                      setSelectedEvents(
                        e.target.checked
                          ? [...selectedEvents, evt]
                          : selectedEvents.filter((x) => x !== evt),
                      )
                    }
                  />
                  {evt}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={selectedEvents.length === 0}>
            Create Webhook
          </Button>
        </form>
      )}

      <div className="space-y-3">
        {webhooks.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No webhooks configured yet.
          </p>
        )}
        {webhooks.map((w) => (
          <div key={w.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{w.url}</p>
              {w.description && (
                <p className="text-xs text-muted-foreground">{w.description}</p>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {w.events.map((evt) => (
                  <span key={evt} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {evt}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Secret: <code className="bg-muted px-1 rounded">{w.secret.slice(0, 12)}...</code>
                {w._count && ` · ${w._count.deliveries} deliveries`}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(w.id)}>
              Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

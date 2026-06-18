'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionSaveFeedback } from '@/components/save-feedback';
import { useMultiSectionSaveFeedback } from '@/lib/use-save-feedback';
import { sendPlatformMessage } from './platform-inbox-actions';

export function ContactMarineFlow() {
  const { getSection, reportSuccess, reportError } = useMultiSectionSaveFeedback();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await sendPlatformMessage(subject, body);
      if (result.error) {
        reportError('platformMessage', result.error);
      } else {
        reportSuccess('platformMessage', 'Message sent — MarineFlow support will get back to you.');
        setSubject('');
        setBody('');
      }
    } catch {
      reportError('platformMessage', 'Send failed — please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 max-w-lg">
      <div className="space-y-2">
        <Label htmlFor="platform-subject">Subject</Label>
        <Input
          id="platform-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Need help with WhatsApp setup"
          maxLength={200}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="platform-body">Message</Label>
        <textarea
          id="platform-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe what you need — billing, bot issues, new features…"
          rows={5}
          maxLength={8000}
          required
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[120px]"
        />
      </div>
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? 'Sending…' : 'Send to MarineFlow'}
      </Button>
      <SectionSaveFeedback feedback={getSection('platformMessage')} />
      <p className="text-xs text-muted-foreground">
        Goes straight to the MarineFlow admin inbox for your business. Bot errors are also reported there automatically.
      </p>
    </form>
  );
}

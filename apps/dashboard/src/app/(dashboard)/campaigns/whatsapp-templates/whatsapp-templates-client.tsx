'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Clock,
  FileText,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { DashboardToast } from '@/components/dashboard-toast';
import { SaveErrorFeedback } from '@/components/save-feedback';
import { useSaveFeedback } from '@/lib/use-save-feedback';
import { apiFetch, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { WhatsappTemplateImageUpload } from './whatsapp-template-image-upload';
import { WhatsappCardPreview } from './whatsapp-card-preview';
import {
  WHATSAPP_BUTTON_TYPE_LABELS,
  type WhatsappCardAction,
  type WhatsappCardActionType,
  type WhatsappTemplate,
  type WhatsappTemplateCategory,
} from './whatsapp-template-types';

interface Props {
  token: string;
}

interface TemplateForm {
  name: string;
  category: WhatsappTemplateCategory;
  language: string;
  mediaUrl: string | null;
  headerText: string;
  body: string;
  footer: string;
  buttons: WhatsappCardAction[];
}

const BODY_MAX = 1024;
const FOOTER_MAX = 60;
const HEADER_MAX = 60;
const MAX_BUTTONS = 3;

const emptyForm: TemplateForm = {
  name: '',
  category: 'MARKETING',
  language: 'en',
  mediaUrl: null,
  headerText: '',
  body: '',
  footer: '',
  buttons: [],
};

function emptyButton(): WhatsappCardAction {
  return { type: 'URL', title: '' };
}

function formatSaveError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong — please try again';
}

function statusMeta(status: WhatsappTemplate['status']) {
  switch (status) {
    case 'DRAFT':
      return { label: 'Draft', className: 'bg-muted text-muted-foreground border-border' };
    case 'PENDING':
      return { label: 'Pending review', className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-600/30' };
    case 'APPROVED':
      return { label: 'Approved', className: 'bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30' };
    case 'REJECTED':
      return { label: 'Rejected', className: 'bg-destructive/10 text-destructive border-destructive/30' };
  }
}

export function WhatsappTemplatesClient({ token }: Props) {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { error: saveError, clear: clearSaveFeedback, reportError } = useSaveFeedback();

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadTemplates = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ templates: WhatsappTemplate[] }>('/whatsapp-templates', {}, token);
      setTemplates(res.templates);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not load templates', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const openCreate = () => {
    setForm(emptyForm);
    clearSaveFeedback();
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    clearSaveFeedback();
  };

  const updateButton = (index: number, patch: Partial<WhatsappCardAction>) => {
    setForm((f) => ({
      ...f,
      buttons: f.buttons.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));
  };

  const addButton = () => {
    if (form.buttons.length >= MAX_BUTTONS) return;
    setForm((f) => ({ ...f, buttons: [...f.buttons, emptyButton()] }));
  };

  const removeButton = (index: number) => {
    setForm((f) => ({ ...f, buttons: f.buttons.filter((_, i) => i !== index) }));
  };

  const validateForm = (): boolean => {
    if (!form.name.trim()) {
      reportError('Add a template name.');
      return false;
    }
    if (!form.body.trim()) {
      reportError('Body text is required.');
      return false;
    }
    if (form.body.length > BODY_MAX) {
      reportError(`Body text must be ${BODY_MAX} characters or fewer.`);
      return false;
    }
    if (form.footer.length > FOOTER_MAX) {
      reportError(`Footer must be ${FOOTER_MAX} characters or fewer.`);
      return false;
    }
    if (form.headerText.length > HEADER_MAX) {
      reportError(`Header text must be ${HEADER_MAX} characters or fewer.`);
      return false;
    }
    if (!form.mediaUrl && !form.headerText.trim() && form.buttons.length === 0) {
      reportError('Add a header image, header text, or at least one button.');
      return false;
    }
    for (const btn of form.buttons) {
      if (!btn.title.trim()) {
        reportError('Every button needs a label.');
        return false;
      }
      if (btn.type === 'URL' && !btn.url?.trim()) {
        reportError('URL buttons need a link.');
        return false;
      }
      if (btn.type === 'PHONE_NUMBER' && !btn.phone?.trim()) {
        reportError('Phone buttons need a number.');
        return false;
      }
    }
    clearSaveFeedback();
    return true;
  };

  const handleSave = async () => {
    if (!token || !validateForm()) return;
    setSaving(true);
    try {
      await apiFetch(
        '/whatsapp-templates',
        {
          method: 'POST',
          body: JSON.stringify({
            name: form.name.trim(),
            category: form.category,
            language: form.language,
            headerText: form.headerText.trim() || null,
            mediaUrl: form.mediaUrl,
            body: form.body.trim(),
            footer: form.footer.trim() || null,
            buttons: form.buttons,
          }),
        },
        token,
      );
      showToast('Template saved as draft', 'success');
      closeSheet();
      await loadTemplates();
    } catch (err) {
      reportError(formatSaveError(err));
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async (id: string) => {
    if (!token) return;
    setActionId(id);
    try {
      await apiFetch(`/whatsapp-templates/${id}/submit`, { method: 'POST' }, token);
      showToast('Submitted for Meta review', 'success');
      await loadTemplates();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not submit for review', 'error');
    } finally {
      setActionId(null);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!token) return;
    setActionId(id);
    try {
      await apiFetch(`/whatsapp-templates/${id}`, { method: 'DELETE' }, token);
      showToast('Template deleted', 'success');
      setPendingDeleteId(null);
      await loadTemplates();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not delete template', 'error');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to newsletters
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#25d366]/20 to-[#128c7e]/10 ring-1 ring-[#25d366]/20">
              <BadgeCheck className="size-5 text-[#128c7e]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Approved WhatsApp templates</h1>
              <p className="text-muted-foreground text-sm mt-1 max-w-xl leading-relaxed">
                Meta-approved rich card templates — image, text, and a button — that reach
                customers outside the 24-hour WhatsApp session window.
              </p>
            </div>
          </div>
        </div>
        <div className="shrink-0 sm:pt-8">
          <Button size="sm" onClick={openCreate} className="bg-[#128c7e] hover:bg-[#0d6b5f] text-white shadow-sm">
            <Plus className="size-4 mr-1.5" />
            New template
          </Button>
        </div>
      </div>

      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="py-4 text-sm text-muted-foreground leading-relaxed">
          Templates must be submitted to Meta for approval before they can be attached to a
          campaign. Approval can take from a few minutes to a day. Header images must be a
          public HTTPS URL — uploads only work once file storage (S3) is configured on this
          server.
        </CardContent>
      </Card>

      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-[100px] rounded-xl bg-muted animate-pulse ring-1 ring-border/50" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-[#25d366]/10 mb-5">
                <Sparkles className="size-7 text-[#128c7e]" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Create your first approved template</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md leading-relaxed">
                Build a rich card with an image, headline, and button — then submit it to Meta so
                you can message customers anytime, not just within 24 hours of their last reply.
              </p>
              <Button onClick={openCreate} className="bg-[#128c7e] hover:bg-[#0d6b5f] text-white">
                <Plus className="size-4 mr-1.5" />
                New template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => {
              const meta = statusMeta(t.status);
              const busy = actionId === t.id;
              const canDelete = t.status === 'DRAFT' || t.status === 'REJECTED';
              const canSubmit = t.status === 'DRAFT' || t.status === 'REJECTED';

              return (
                <Card key={t.id} className="overflow-hidden">
                  <CardContent className="p-5">
                    {pendingDeleteId === t.id ? (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                        <div className="flex gap-2">
                          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-destructive" />
                          <p className="text-sm">
                            Delete <strong>{t.name}</strong>? This cannot be undone.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-destructive hover:bg-destructive/90 text-white"
                            onClick={() => void deleteTemplate(t.id)}
                            disabled={busy}
                          >
                            {busy ? <Loader2 className="size-3.5 animate-spin" /> : 'Yes, delete'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setPendingDeleteId(null)} disabled={busy}>
                            Go back
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold truncate">{t.name}</h3>
                            <Badge variant="outline" className={cn('shrink-0', meta.className)}>
                              {meta.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs font-normal">
                              {t.category === 'MARKETING' ? 'Marketing' : 'Utility'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{t.body}</p>
                          {t.status === 'REJECTED' && t.rejectionReason && (
                            <p className="text-xs text-destructive inline-flex items-start gap-1.5">
                              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                              {t.rejectionReason}
                            </p>
                          )}
                          {t.status === 'PENDING' && t.submittedAt && (
                            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                              <Clock className="size-3.5" />
                              Submitted {new Date(t.submittedAt).toLocaleString('en-ZA')}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          {canSubmit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void submitForReview(t.id)}
                              disabled={busy}
                              className="border-[#25d366]/40 text-[#128c7e] hover:bg-[#25d366]/10"
                            >
                              {busy ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Send className="size-3.5 mr-1" />}
                              Submit for review
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPendingDeleteId(t.id)}
                              disabled={busy}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-3.5 mr-1" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={(o) => !o && closeSheet()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto px-6">
          <SheetHeader className="text-left pb-2">
            <SheetTitle className="text-xl">New WhatsApp template</SheetTitle>
            <SheetDescription className="leading-relaxed">
              Saved as a draft first — submit for Meta review once you&apos;re happy with it.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Template name</Label>
              <Input
                id="tpl-name"
                placeholder="Summer sale card"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">Internal name — not shown to customers.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tpl-category">Category</Label>
                <select
                  id="tpl-category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as WhatsappTemplateCategory }))}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  <option value="MARKETING">Marketing</option>
                  <option value="UTILITY">Utility</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-language">Language</Label>
                <Input
                  id="tpl-language"
                  value={form.language}
                  onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                  placeholder="en"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Header image</Label>
              <WhatsappTemplateImageUpload
                token={token}
                mediaUrl={form.mediaUrl}
                onChange={(mediaUrl) => setForm((f) => ({ ...f, mediaUrl }))}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="tpl-header">Header text (optional)</Label>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {form.headerText.length}/{HEADER_MAX}
                </span>
              </div>
              <Input
                id="tpl-header"
                maxLength={HEADER_MAX}
                placeholder="Summer Sale"
                value={form.headerText}
                onChange={(e) => setForm((f) => ({ ...f, headerText: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="tpl-body">Body text</Label>
                <span
                  className={cn(
                    'text-[11px] tabular-nums',
                    form.body.length > BODY_MAX * 0.9 && 'text-amber-600',
                    form.body.length > BODY_MAX && 'text-destructive',
                  )}
                >
                  {form.body.length}/{BODY_MAX}
                </span>
              </div>
              <textarea
                id="tpl-body"
                rows={4}
                maxLength={BODY_MAX}
                placeholder="20% off this week only — book before Sunday."
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#128c7e]/30 resize-y min-h-[108px] leading-relaxed"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="tpl-footer">Footer (optional)</Label>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {form.footer.length}/{FOOTER_MAX}
                </span>
              </div>
              <Input
                id="tpl-footer"
                maxLength={FOOTER_MAX}
                placeholder="Offer valid in-store only"
                value={form.footer}
                onChange={(e) => setForm((f) => ({ ...f, footer: e.target.value }))}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Buttons (optional, up to {MAX_BUTTONS})</Label>
                {form.buttons.length < MAX_BUTTONS && (
                  <Button type="button" variant="outline" size="sm" onClick={addButton}>
                    <Plus className="size-3.5 mr-1" />
                    Add button
                  </Button>
                )}
              </div>

              {form.buttons.map((btn, i) => (
                <div key={i} className="rounded-xl border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={btn.type}
                      onChange={(e) => updateButton(i, { type: e.target.value as WhatsappCardActionType })}
                      className="flex h-8 rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring dark:bg-input/30"
                    >
                      {WHATSAPP_BUTTON_TYPE_LABELS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeButton(i)}
                      className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label="Remove button"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <Input
                    placeholder="Button label"
                    value={btn.title}
                    onChange={(e) => updateButton(i, { title: e.target.value })}
                  />
                  {btn.type === 'URL' && (
                    <Input
                      placeholder="https://example.com/book"
                      value={btn.url ?? ''}
                      onChange={(e) => updateButton(i, { url: e.target.value })}
                    />
                  )}
                  {btn.type === 'PHONE_NUMBER' && (
                    <Input
                      placeholder="+27 12 345 6789"
                      value={btn.phone ?? ''}
                      onChange={(e) => updateButton(i, { phone: e.target.value })}
                    />
                  )}
                  {btn.type === 'COPY_CODE' && (
                    <Input
                      placeholder="SAVE20"
                      value={btn.code ?? ''}
                      onChange={(e) => updateButton(i, { code: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1.5">
                <FileText className="size-3.5" />
                Preview
              </Label>
              <WhatsappCardPreview
                headerText={form.headerText || null}
                mediaUrl={form.mediaUrl}
                body={form.body}
                footer={form.footer || null}
                buttons={form.buttons}
              />
            </div>
          </div>

          <SheetFooter className="flex-col sm:flex-col gap-2 border-t pt-5 mt-2">
            <SaveErrorFeedback message={saveError} />
            <Button
              className="w-full h-11 bg-[#128c7e] hover:bg-[#0d6b5f] text-white font-medium shadow-sm"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Save as draft
            </Button>
            <Button variant="ghost" className="w-full" onClick={closeSheet} disabled={saving}>
              Discard
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {toast && <DashboardToast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}

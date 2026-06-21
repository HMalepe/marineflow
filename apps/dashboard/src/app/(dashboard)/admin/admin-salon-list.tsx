'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  TenantHealthTable,
  type TenantHealthRow,
  type TenantHealthStatus,
} from '@/components/TenantHealthTable';
import { formatSaPhone, isValidSaPhoneLocal, formatSaPhoneDisplay } from '@/lib/phone';
import { OpenClientDashboardButton } from '@/components/open-client-dashboard-button';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { DashboardToast } from '@/components/dashboard-toast';
import { PLATFORM_BOT_NAME } from '@/lib/bot-branding';

import { resolveApiUrl } from '@/lib/api-config';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://dashboard.marineflow.co.za';

interface Salon extends TenantHealthRow {}

const HEALTH_FILTERS: { value: TenantHealthStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'HEALTHY', label: 'Healthy' },
  { value: 'AT_RISK', label: 'At risk' },
  { value: 'CHURNING', label: 'Churning' },
];

const INDUSTRY_TEMPLATE_OPTIONS = [
  { value: 'salon', label: 'Hair & Beauty Salon' },
  { value: 'barbershop', label: 'Barbershop' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'spa', label: 'Spa & Wellness' },
  { value: 'fitness', label: 'Fitness Studio' },
  { value: 'clinic', label: 'Medical / Dental Clinic' },
  { value: 'petgrooming', label: 'Pet Grooming' },
  { value: 'carwash', label: 'Car Wash & Detailing' },
];

interface CreatedSalonCredentials {
  salonName: string;
  whatsappNumber: string;
  ownerEmail: string;
}

interface TwilioWhatsAppOption {
  phoneE164: string;
  twilioWhatsAppNumber: string;
  status: string | null;
  assignedSalon: { id: string; name: string } | null;
}

interface Props {
  token: string;
}

type StaffRoleOption = 'OWNER' | 'MANAGER' | 'STYLIST';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function adminFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(resolveApiUrl('admin', path, { forBrowser: true }), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export function AdminSalonList({ token }: Props) {
  const searchParams = useSearchParams();
  const healthParam = searchParams.get('health')?.toUpperCase();
  const healthFilter: TenantHealthStatus | null =
    healthParam === 'AT_RISK' || healthParam === 'CHURNING' || healthParam === 'HEALTHY'
      ? healthParam
      : null;
  const incompleteOnly = searchParams.get('onboarding') === 'incomplete';

  const [tenants, setTenants] = useState<TenantHealthRow[]>([]);
  const [atRiskCount, setAtRiskCount] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [addUserSalon, setAddUserSalon] = useState<Salon | null>(null);
  const [brandSalon, setBrandSalon] = useState<Salon | null>(null);
  const [whatsappSalon, setWhatsappSalon] = useState<Salon | null>(null);
  const [whatsappEditValue, setWhatsappEditValue] = useState('');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [brandBotName, setBrandBotName] = useState('');
  const [savingBrand, setSavingBrand] = useState(false);
  const [credentials, setCredentials] = useState<CreatedSalonCredentials | null>(null);

  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    slugManual: false,
    ownerName: '',
    ownerEmail: '',
    whatsappNumber: '',
    timezone: 'Africa/Johannesburg',
    industryTemplate: 'salon',
  });
  const [addUserForm, setAddUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'MANAGER' as StaffRoleOption,
  });
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [twilioNumbers, setTwilioNumbers] = useState<TwilioWhatsAppOption[]>([]);
  const [loadingTwilioNumbers, setLoadingTwilioNumbers] = useState(false);

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = tenants;
    if (q) {
      rows = rows.filter(
        (t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [tenants, search]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!createOpen && !whatsappSalon) return;
    setLoadingTwilioNumbers(true);
    void adminFetch<{ numbers: TwilioWhatsAppOption[] }>('/twilio/whatsapp-numbers', token)
      .then((data) => setTwilioNumbers(data.numbers))
      .catch(() => showToast('Could not load Twilio WhatsApp numbers', 'error'))
      .finally(() => setLoadingTwilioNumbers(false));
  }, [createOpen, whatsappSalon, token, showToast]);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{
        tenants: TenantHealthRow[];
        atRiskCount: number;
      }>('/tenants/health', token);
      setTenants(data.tenants);
      setAtRiskCount(data.atRiskCount);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Failed to load tenant health', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  const createSlugPreview = useMemo(() => {
    if (createForm.slugManual) return createForm.slug;
    return slugify(createForm.name);
  }, [createForm.name, createForm.slug, createForm.slugManual]);

  function resetCreateForm() {
    setCreateForm({
      name: '',
      slug: '',
      slugManual: false,
      ownerName: '',
      ownerEmail: '',
      whatsappNumber: '',
      timezone: 'Africa/Johannesburg',
      industryTemplate: 'salon',
    });
  }

  function resetAddUserForm() {
    setAddUserForm({ name: '', email: '', phone: '', password: '', role: 'MANAGER' });
  }

  async function handleCreateSalon(e: React.FormEvent) {
    e.preventDefault();
    const slug = createForm.slugManual ? createForm.slug.trim() : slugify(createForm.name);
    if (!createForm.name.trim() || !slug || !createForm.ownerEmail.trim() || !createForm.ownerName.trim()) {
      showToast('Fill in all required fields', 'error');
      return;
    }
    if (!createForm.whatsappNumber.trim()) {
      showToast('WhatsApp business number is required', 'error');
      return;
    }

    setSavingCreate(true);
    try {
      await adminFetch<{ salon: Salon; user: { email: string; phone: string | null } }>(
        '/salons',
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            name: createForm.name.trim(),
            slug,
            ownerName: createForm.ownerName.trim(),
            ownerEmail: createForm.ownerEmail.trim(),
            timezone: createForm.timezone,
            industryTemplate: createForm.industryTemplate,
            whatsappNumber: createForm.whatsappNumber.trim(),
          }),
        },
      );

      setCredentials({
        salonName: createForm.name.trim(),
        whatsappNumber: createForm.whatsappNumber.trim(),
        ownerEmail: createForm.ownerEmail.trim(),
      });
      setCreateOpen(false);
      resetCreateForm();
      showToast('Business created', 'success');
      await loadTenants();
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.message.includes('invalid_whatsapp_number_format')) {
          showToast('Use format whatsapp:+27XXXXXXXXX (10–15 digits)', 'error');
        } else if (e.message.includes('whatsapp_not_on_twilio')) {
          showToast('That number is not on your Twilio account', 'error');
        } else if (e.message.includes('whatsapp_already_assigned')) {
          showToast('That number is already assigned to another business', 'error');
        } else {
          showToast(e.message, 'error');
        }
      } else {
        showToast('Create failed', 'error');
      }
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!addUserSalon) return;
    if (!addUserForm.name.trim() || !addUserForm.email.trim() || addUserForm.password.length < 8) {
      showToast('Name, email, and password (8+ chars) are required', 'error');
      return;
    }
    if (addUserForm.phone && !isValidSaPhoneLocal(addUserForm.phone)) {
      showToast('Enter a valid phone number', 'error');
      return;
    }

    setSavingUser(true);
    try {
      const phone = addUserForm.phone.trim()
        ? formatSaPhone(addUserForm.phone)
        : undefined;

      await adminFetch(`/salons/${addUserSalon.id}/users`, token, {
        method: 'POST',
        body: JSON.stringify({
          name: addUserForm.name.trim(),
          email: addUserForm.email.trim(),
          password: addUserForm.password,
          role: addUserForm.role,
          ...(phone && { phone }),
        }),
      });

      setAddUserSalon(null);
      resetAddUserForm();
      showToast('User added', 'success');
      await loadTenants();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Add user failed', 'error');
    } finally {
      setSavingUser(false);
    }
  }

  function openBrandEditor(salon: Salon) {
    setBrandSalon(salon);
    setBrandBotName(salon.botName?.trim() || PLATFORM_BOT_NAME);
  }

  async function handleSaveBrand(e: React.FormEvent) {
    e.preventDefault();
    if (!brandSalon) return;
    const trimmed = brandBotName.trim();
    if (!trimmed || trimmed.length < 2 || trimmed.length > 40) {
      showToast('Bot name must be 2–40 characters', 'error');
      return;
    }
    setSavingBrand(true);
    try {
      await adminFetch(`/salons/${brandSalon.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ botName: trimmed }),
      });
      setBrandSalon(null);
      showToast('Assistant name updated', 'success');
      await loadTenants();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Update failed', 'error');
    } finally {
      setSavingBrand(false);
    }
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Tenant health</h2>
          <p className="text-sm text-muted-foreground">
            {tenants.length} business{tenants.length !== 1 ? 'es' : ''} on platform
            {atRiskCount > 0 && (
              <> · <span className="text-amber-700 dark:text-amber-400">{atRiskCount} at risk</span></>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            className="w-48 sm:w-64"
            placeholder="Search name or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button onClick={() => setCreateOpen(true)}>Create New Business</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {HEALTH_FILTERS.map((f) => {
          const params = new URLSearchParams();
          if (f.value !== 'ALL') params.set('health', f.value);
          if (incompleteOnly) params.set('onboarding', 'incomplete');
          const qs = params.toString();
          const href = qs ? `/admin?${qs}` : '/admin';
          const active = f.value === 'ALL' ? !healthFilter : healthFilter === f.value;
          return (
            <Link
              key={f.value}
              href={href}
              className={cn(
                'inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40',
              )}
            >
              {f.label}
            </Link>
          );
        })}
        <Link
          href={
            incompleteOnly
              ? healthFilter
                ? `/admin?health=${healthFilter}`
                : '/admin'
              : `/admin?onboarding=incomplete${healthFilter ? `&health=${healthFilter}` : ''}`
          }
          className={cn(
            'inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            incompleteOnly
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40',
          )}
        >
          Incomplete onboarding only
        </Link>
      </div>

      <TenantHealthTable
        tenants={filteredTenants}
        loading={loading}
        healthFilter={healthFilter}
        incompleteOnly={incompleteOnly}
        actions={(t) => (
          <div className="flex justify-end gap-1 flex-wrap items-center">
            <OpenClientDashboardButton
              businessId={t.id}
              businessName={t.name}
              onError={(msg) => showToast(msg, 'error')}
            />
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/businesses/${t.id}`} />}>
              Stats
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openBrandEditor(t)}>
              Brand
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setWhatsappSalon(t);
                setWhatsappEditValue('');
              }}
            >
              WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddUserSalon(t)}>
              Add User
            </Button>
          </div>
        )}
      />

      {credentials && (
        <Card className="border-green-600/30 bg-green-600/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Share these with your client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              First-time login for <span className="font-medium text-foreground">{credentials.salonName}</span>
              {' '}(shown once — copy now):
            </p>
            <dl className="grid gap-1 font-mono text-xs bg-background/80 rounded-lg border p-3">
              <div className="flex gap-2"><dt className="text-muted-foreground shrink-0">Dashboard:</dt><dd>{DASHBOARD_URL}/login</dd></div>
              <div className="flex gap-2"><dt className="text-muted-foreground shrink-0">WhatsApp #:</dt><dd>{credentials.whatsappNumber}</dd></div>
              <div className="flex gap-2"><dt className="text-muted-foreground shrink-0">Steps:</dt><dd>Enter WhatsApp number → create password → done</dd></div>
              <div className="flex gap-2"><dt className="text-muted-foreground shrink-0">Email fallback:</dt><dd>{credentials.ownerEmail}</dd></div>
            </dl>
            <Button variant="outline" size="sm" onClick={() => setCredentials(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      {/* Create Salon Sheet */}
      <Sheet open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); resetCreateForm(); } }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create New Business</SheetTitle>
            <SheetDescription>Set up a new business with an owner account.</SheetDescription>
          </SheetHeader>
          <form onSubmit={(e) => void handleCreateSalon(e)} className="flex flex-col gap-4 px-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="biz-name">Business name *</Label>
              <Input
                id="biz-name"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={createForm.slugManual ? createForm.slug : createSlugPreview}
                onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value, slugManual: true }))}
                required
              />
              <p className="text-xs text-muted-foreground">Auto-generated from name; edit if needed.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner-name">Owner name *</Label>
              <Input id="owner-name" value={createForm.ownerName} onChange={(e) => setCreateForm((f) => ({ ...f, ownerName: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner-email">Owner email *</Label>
              <Input id="owner-email" type="email" value={createForm.ownerEmail} onChange={(e) => setCreateForm((f) => ({ ...f, ownerEmail: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp number *</Label>
              <Input
                id="whatsapp"
                list="twilio-whatsapp-suggestions"
                value={createForm.whatsappNumber}
                onChange={(e) => setCreateForm((f) => ({ ...f, whatsappNumber: e.target.value }))}
                placeholder="whatsapp:+XXXXXXXXXXX"
                required
              />
              <datalist id="twilio-whatsapp-suggestions">
                {twilioNumbers.map((n) => (
                  <option key={n.phoneE164} value={n.twilioWhatsAppNumber} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Format: <code className="text-[11px]">whatsapp:+XXXXXXXXXXX</code> — one number per business.
                Pick from Twilio senders below; a number already linked to another tenant cannot be reused.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" value={createForm.timezone} onChange={(e) => setCreateForm((f) => ({ ...f, timezone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <select
                id="industry"
                value={createForm.industryTemplate}
                onChange={(e) => setCreateForm((f) => ({ ...f, industryTemplate: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {INDUSTRY_TEMPLATE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Controls bot menu wording (e.g. &quot;Book a table&quot; vs &quot;Book an appointment&quot;) — the flow stays the same.
              </p>
            </div>
            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={savingCreate}>{savingCreate ? 'Creating…' : 'Create business'}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Add User Sheet */}
      <Sheet open={!!addUserSalon} onOpenChange={(open) => { if (!open) { setAddUserSalon(null); resetAddUserForm(); } }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add user</SheetTitle>
            <SheetDescription>
              {addUserSalon ? `New staff login for ${addUserSalon.name}` : ''}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={(e) => void handleAddUser(e)} className="flex flex-col gap-4 px-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Name *</Label>
              <Input id="user-name" value={addUserForm.name} onChange={(e) => setAddUserForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email *</Label>
              <Input id="user-email" type="email" value={addUserForm.email} onChange={(e) => setAddUserForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-phone">Phone</Label>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-lg border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">+27</span>
                <Input
                  id="user-phone"
                  type="tel"
                  value={addUserForm.phone}
                  onChange={(e) => setAddUserForm((f) => ({ ...f, phone: formatSaPhoneDisplay(e.target.value) }))}
                  placeholder="82 123 4567"
                  className="rounded-l-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Password *</Label>
              <PasswordInput id="user-password" minLength={8} value={addUserForm.password} onChange={(e) => setAddUserForm((f) => ({ ...f, password: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <select
                id="user-role"
                value={addUserForm.role}
                onChange={(e) => setAddUserForm((f) => ({ ...f, role: e.target.value as StaffRoleOption }))}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none dark:bg-input/30"
              >
                <option value="OWNER">Owner</option>
                <option value="MANAGER">Manager</option>
                <option value="STYLIST">Stylist</option>
              </select>
            </div>
            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={() => setAddUserSalon(null)}>Cancel</Button>
              <Button type="submit" disabled={savingUser}>{savingUser ? 'Adding…' : 'Add user'}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* WhatsApp number (super admin) */}
      <Sheet open={!!whatsappSalon} onOpenChange={(open) => { if (!open) setWhatsappSalon(null); }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>WhatsApp number</SheetTitle>
            <SheetDescription>
              {whatsappSalon ? `Inbound/outbound routing for ${whatsappSalon.name}` : ''}
            </SheetDescription>
          </SheetHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!whatsappSalon) return;
              void (async () => {
                setSavingWhatsapp(true);
                try {
                  await adminFetch(`/salons/${whatsappSalon.id}`, token, {
                    method: 'PATCH',
                    body: JSON.stringify({ whatsappNumber: whatsappEditValue.trim() }),
                  });
                  showToast('WhatsApp number saved', 'success');
                  setWhatsappSalon(null);
                  await loadTenants();
                } catch (err) {
                  if (err instanceof ApiError) {
                    if (err.message.includes('invalid_whatsapp_number_format')) {
                      showToast('Use format whatsapp:+27XXXXXXXXX', 'error');
                    } else if (err.message.includes('whatsapp_already_assigned')) {
                      showToast('That number is already assigned to another business', 'error');
                    } else {
                      showToast(err.message, 'error');
                    }
                  } else {
                    showToast('Save failed', 'error');
                  }
                } finally {
                  setSavingWhatsapp(false);
                }
              })();
            }}
            className="flex flex-col gap-4 px-4 pb-4"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-whatsapp">WhatsApp number</Label>
              <Input
                id="edit-whatsapp"
                list="twilio-whatsapp-suggestions-edit"
                value={whatsappEditValue}
                onChange={(e) => setWhatsappEditValue(e.target.value)}
                placeholder="whatsapp:+XXXXXXXXXXX"
                required
              />
              <datalist id="twilio-whatsapp-suggestions-edit">
                {twilioNumbers.map((n) => (
                  <option key={n.phoneE164} value={n.twilioWhatsAppNumber}>
                    {n.assignedSalon && n.assignedSalon.id !== whatsappSalon?.id
                      ? `(assigned: ${n.assignedSalon.name})`
                      : ''}
                  </option>
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Must match <code className="text-[11px]">whatsapp:+XXXXXXXXXXX</code>. Inbound Twilio webhooks route
                by this number — each business has its own; customers messaging tenant A never hit tenant B&apos;s bot.
                {loadingTwilioNumbers ? ' Loading Twilio senders…' : ''}
              </p>
            </div>
            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={() => setWhatsappSalon(null)}>Cancel</Button>
              <Button type="submit" disabled={savingWhatsapp}>{savingWhatsapp ? 'Saving…' : 'Save'}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Bot branding (super admin only) */}
      <Sheet open={!!brandSalon} onOpenChange={(open) => { if (!open) setBrandSalon(null); }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Assistant branding</SheetTitle>
            <SheetDescription>
              {brandSalon ? `WhatsApp assistant name for ${brandSalon.name}` : ''}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={(e) => void handleSaveBrand(e)} className="flex flex-col gap-4 px-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="brand-bot-name">Assistant name</Label>
              <Input
                id="brand-bot-name"
                value={brandBotName}
                onChange={(e) => setBrandBotName(e.target.value)}
                placeholder={PLATFORM_BOT_NAME}
                maxLength={40}
                required
              />
              <p className="text-xs text-muted-foreground">
                Shown in greetings (&quot;Hi! I&apos;m …&quot;). Business owners cannot change this — they edit their
                business name in Settings instead.
              </p>
            </div>
            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={() => setBrandSalon(null)}>Cancel</Button>
              <Button type="submit" disabled={savingBrand}>{savingBrand ? 'Saving…' : 'Save'}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {toast && <DashboardToast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}

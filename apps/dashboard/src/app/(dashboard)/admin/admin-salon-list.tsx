'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { impersonateSalon } from './actions';
import { formatSaPhone, isValidSaPhoneLocal, stripPhoneDigits, formatSaPhoneDisplay } from '@/lib/phone';
import { ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://dashboard.marineflow.co.za';

interface Salon {
  id: string;
  name: string;
  slug: string;
  status: string;
  tier: string;
  createdAt: string;
  staffUserCount: number;
  customerCount: number;
}

interface CreatedSalonCredentials {
  salonName: string;
  whatsappNumber: string;
  ownerEmail: string;
}

interface TwilioWhatsAppOption {
  phoneE164: string;
  twilioWhatsAppFrom: string;
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

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    TRIAL: 'bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border-yellow-600/30',
    ACTIVE: 'bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/30',
    SUSPENDED: 'bg-destructive/10 text-destructive border-destructive/30',
    CHURNED: 'bg-muted text-muted-foreground border-border',
    PAST_DUE: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-600/30',
    LEAD: 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-600/30',
  };
  return (
    <Badge className={cn('border', cls[status] ?? 'bg-muted')}>{status}</Badge>
  );
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <Badge variant="outline" className="capitalize">
      {tier}
    </Badge>
  );
}

function Toast({
  message,
  type,
  onDismiss,
}: {
  message: string;
  type: 'success' | 'error';
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg max-w-sm',
        type === 'success' ? 'bg-card border-green-600/30' : 'bg-destructive/10 border-destructive/40 text-destructive',
      )}
    >
      <Badge className={cn('shrink-0 border-0', type === 'success' && 'bg-green-600/15 text-green-700 dark:text-green-400')} variant={type === 'success' ? 'secondary' : 'destructive'}>
        {type === 'success' ? 'Done' : 'Error'}
      </Badge>
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onDismiss} className="text-xs text-muted-foreground hover:text-foreground" aria-label="Dismiss">✕</button>
    </div>
  );
}

async function adminFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}/admin${path}`, {
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
  const [salons, setSalons] = useState<Salon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [addUserSalon, setAddUserSalon] = useState<Salon | null>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);
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

  const pages = Math.max(1, Math.ceil(total / 25));

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!createOpen) return;
    setLoadingTwilioNumbers(true);
    void adminFetch<{ numbers: TwilioWhatsAppOption[] }>('/twilio/whatsapp-numbers', token)
      .then((data) => setTwilioNumbers(data.numbers))
      .catch(() => showToast('Could not load Twilio WhatsApp numbers', 'error'))
      .finally(() => setLoadingTwilioNumbers(false));
  }, [createOpen, token, showToast]);

  const loadSalons = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search.trim()) params.set('search', search.trim());
      const data = await adminFetch<{ salons: Salon[]; total: number }>(
        `/salons?${params}`,
        token,
      );
      setSalons(data.salons);
      setTotal(data.total);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Failed to load salons', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, page, search, showToast]);

  useEffect(() => {
    void loadSalons();
  }, [loadSalons]);

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
      showToast('Salon created', 'success');
      await loadSalons();
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.message.includes('whatsapp_not_on_twilio')) {
          showToast('That number is not on your Twilio account', 'error');
        } else if (e.message.includes('whatsapp_already_assigned')) {
          showToast('That number is already assigned to another salon', 'error');
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
    if (addUserForm.phone && !isValidSaPhoneLocal(stripPhoneDigits(addUserForm.phone))) {
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
      await loadSalons();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Add user failed', 'error');
    } finally {
      setSavingUser(false);
    }
  }

  async function handleImpersonate(salon: Salon) {
    setImpersonating(salon.id);
    try {
      const res = await adminFetch<{ token: string }>(`/salons/${salon.id}/impersonate`, token, { method: 'POST' });
      await impersonateSalon(res.token);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Impersonation failed', 'error');
      setImpersonating(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Salon management</h2>
          <p className="text-sm text-muted-foreground">{total} salon{total !== 1 ? 's' : ''} on platform</p>
        </div>
        <div className="flex gap-2">
          <Input
            className="w-48 sm:w-64"
            placeholder="Search name or slug…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <Button onClick={() => setCreateOpen(true)}>Create New Salon</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Staff</TableHead>
                <TableHead className="text-right">Customers</TableHead>
                <TableHead className="text-right w-[160px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Loading salons…
                  </TableCell>
                </TableRow>
              )}
              {!loading && salons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No salons found.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                salons.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                    <TableCell><TierBadge tier={s.tier} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.staffUserCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.customerCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" disabled={impersonating === s.id} onClick={() => void handleImpersonate(s)}>
                          {impersonating === s.id ? '…' : 'Login as'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setAddUserSalon(s)}>
                          Add User
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}

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
            <SheetTitle>Create New Salon</SheetTitle>
            <SheetDescription>Set up a new salon with an owner account.</SheetDescription>
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
              <Label htmlFor="whatsapp">WhatsApp business number *</Label>
              <select
                id="whatsapp"
                value={createForm.whatsappNumber}
                onChange={(e) => setCreateForm((f) => ({ ...f, whatsappNumber: e.target.value }))}
                required
                disabled={loadingTwilioNumbers}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">
                  {loadingTwilioNumbers ? 'Loading Twilio numbers…' : 'Select a Twilio WhatsApp number…'}
                </option>
                {twilioNumbers.map((n) => (
                  <option key={n.phoneE164} value={n.phoneE164} disabled={!!n.assignedSalon}>
                    {n.phoneE164}
                    {n.assignedSalon ? ` (assigned to ${n.assignedSalon.name})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Only numbers registered on your Twilio account. The owner uses this to sign in and create their password.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" value={createForm.timezone} onChange={(e) => setCreateForm((f) => ({ ...f, timezone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" value={createForm.industryTemplate} onChange={(e) => setCreateForm((f) => ({ ...f, industryTemplate: e.target.value }))} />
            </div>
            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={savingCreate}>{savingCreate ? 'Creating…' : 'Create salon'}</Button>
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

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}

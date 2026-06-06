import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { SettingsForm } from './settings-form';
import { SalonSettingsForm } from './salon-settings-form';

interface MeResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    salonId: string;
  };
}

export default async function SettingsPage() {
  const token = await getToken();
  let user: MeResponse['user'] | null = null;

  try {
    const data = await apiFetch<MeResponse>('/me', {}, token);
    user = data.user;
  } catch {
    // handled in UI
  }

  const canEditSalon = user?.role === 'OWNER' || user?.role === 'MANAGER';

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account, salon hours, and WhatsApp bot</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <SettingsForm user={user} />
          ) : (
            <p className="text-sm text-destructive">Failed to load profile.</p>
          )}
        </CardContent>
      </Card>

      {canEditSalon && token && (
        <Card>
          <CardHeader>
            <CardTitle>Salon &amp; WhatsApp Bot</CardTitle>
            <CardDescription>Hours, automated messages, and bot availability</CardDescription>
          </CardHeader>
          <CardContent>
            <SalonSettingsForm token={token} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Connect external services</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/webhooks"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Manage Webhooks &rarr;
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

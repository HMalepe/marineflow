import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { SettingsForm } from './settings-form';
import { SalonSettingsForm, type SalonSettings } from './salon-settings-form';
import { ChangePasswordForm } from './change-password-form';
import { LogoUpload } from './logo-upload';
import { ContactMarineFlow } from './contact-marineflow';
import { DashboardPageHeader } from '@/components/dashboard-page-header';

interface MeResponse {
  user: {
    id: string;
    email: string;
    phone?: string | null;
    name: string;
    role: string;
    salonId: string;
  };
}

export default async function SettingsPage() {
  const token = await getToken();
  let user: MeResponse['user'] | null = null;
  let salonSettings: SalonSettings | null = null;

  try {
    const data = await apiFetch<MeResponse>('/me', {}, token);
    user = data.user;
  } catch {
    // handled in UI
  }

  const canEditSalon = user?.role === 'OWNER' || user?.role === 'MANAGER';

  let loyaltyProgram: { stampsPerReward: number; rewardDescription: string } | null = null;

  if (canEditSalon && token) {
    try {
      const data = await apiFetch<{ salon: SalonSettings }>('/settings', {}, token);
      salonSettings = data.salon;
    } catch {
      // handled in UI
    }
    try {
      loyaltyProgram = await apiFetch<{ stampsPerReward: number; rewardDescription: string }>('/loyalty/program', {}, token);
    } catch {
      // non-critical
    }
  }

  return (
    <div className="dashboard-page-flow space-y-6 max-w-3xl">
      <DashboardPageHeader
        id="settings-intro"
        title="Settings"
        variant="violet"
        subtitle={
          canEditSalon
            ? 'Manage your account, salon hours, and WhatsApp bot'
            : 'Manage your profile and login password'
        }
      />

      <Card id="settings-profile" data-section-label="Profile" className="dashboard-section-anchor">
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

      {canEditSalon && salonSettings && (
        <Card id="settings-logo" data-section-label="Logo" className="dashboard-section-anchor">
          <CardHeader>
            <CardTitle>Logo</CardTitle>
            <CardDescription>Your salon&apos;s brand mark — shown in the sidebar</CardDescription>
          </CardHeader>
          <CardContent>
            <LogoUpload current={salonSettings.logoUrl} salonName={salonSettings.tradingName ?? salonSettings.name} />
          </CardContent>
        </Card>
      )}

      {canEditSalon && (
        <Card id="settings-salon" data-section-label="Business & bot" className="dashboard-section-anchor">
          <CardHeader>
            <CardTitle>Business &amp; WhatsApp Bot</CardTitle>
            <CardDescription>Dashboard display name, hours, automated messages, and bot availability</CardDescription>
          </CardHeader>
          <CardContent>
            {salonSettings ? (
              <SalonSettingsForm initialSettings={salonSettings} loyaltyProgram={loyaltyProgram} />
            ) : (
              <p className="text-sm text-destructive">Could not load salon settings. Please refresh the page.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card id="settings-password" data-section-label="Password" className="dashboard-section-anchor">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your dashboard login password</CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <ChangePasswordForm email={user.email} phone={user.phone} />
          ) : (
            <p className="text-sm text-destructive">Failed to load profile. Refresh to change password.</p>
          )}
        </CardContent>
      </Card>

      {canEditSalon && (
        <Card id="settings-contact-marineflow" data-section-label="Contact MarineFlow" className="dashboard-section-anchor">
          <CardHeader>
            <CardTitle>Contact MarineFlow</CardTitle>
            <CardDescription>Send a message to platform support — billing, setup, or bot help</CardDescription>
          </CardHeader>
          <CardContent>
            <ContactMarineFlow />
          </CardContent>
        </Card>
      )}

      {canEditSalon && (
        <Card id="settings-integrations" data-section-label="Integrations" className="dashboard-section-anchor">
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
      )}
    </div>
  );
}

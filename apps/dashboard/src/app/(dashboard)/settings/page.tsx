import Link from 'next/link';
import { CollapsibleCard } from '@/components/collapsible-card';
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

      <CollapsibleCard id="settings-profile" title="Profile" description="Your account information">
        {user ? (
          <SettingsForm user={user} />
        ) : (
          <p className="text-sm text-destructive">Failed to load profile.</p>
        )}
      </CollapsibleCard>

      {canEditSalon && salonSettings && (
        <CollapsibleCard
          id="settings-logo"
          title="Logo"
          description="Your salon's brand mark — shown in the sidebar"
        >
          <LogoUpload current={salonSettings.logoUrl} salonName={salonSettings.tradingName ?? salonSettings.name} />
        </CollapsibleCard>
      )}

      {canEditSalon && (
        <CollapsibleCard
          id="settings-salon"
          title="Business & WhatsApp Bot"
          description="Dashboard display name, hours, automated messages, and bot availability"
        >
          {salonSettings ? (
            <SalonSettingsForm initialSettings={salonSettings} loyaltyProgram={loyaltyProgram} />
          ) : (
            <p className="text-sm text-destructive">Could not load salon settings. Please refresh the page.</p>
          )}
        </CollapsibleCard>
      )}

      <CollapsibleCard id="settings-password" title="Change Password" description="Update your dashboard login password">
        {user ? (
          <ChangePasswordForm email={user.email} phone={user.phone} />
        ) : (
          <p className="text-sm text-destructive">Failed to load profile. Refresh to change password.</p>
        )}
      </CollapsibleCard>

      {canEditSalon && (
        <CollapsibleCard
          id="settings-contact-marineflow"
          title="Contact MarineFlow"
          description="Send a message to platform support — billing, setup, or bot help"
        >
          <ContactMarineFlow />
        </CollapsibleCard>
      )}

      {canEditSalon && (
        <CollapsibleCard id="settings-integrations" title="Integrations" description="Connect external services">
          <Link
            href="/settings/webhooks"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Manage Webhooks &rarr;
          </Link>
        </CollapsibleCard>
      )}
    </div>
  );
}

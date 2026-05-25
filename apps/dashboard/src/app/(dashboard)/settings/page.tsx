import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { SettingsForm } from './settings-form';

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your account and salon</p>
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
    </div>
  );
}

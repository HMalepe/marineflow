import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { AppointmentsClient, type AppointmentData } from './appointments-client';

export default async function AppointmentsPage() {
  const token = await getToken();
  let appointments: AppointmentData[] = [];
  let error: string | null = null;

  try {
    const data = await apiFetch<{ appointments: AppointmentData[] }>(
      '/appointments',
      {},
      token,
    );
    appointments = data.appointments;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load';
  }

  const now = Date.now();
  const upcoming = appointments.filter(
    (a) => new Date(a.start).getTime() >= now && a.status !== 'CANCELLED' && a.status !== 'RESCHEDULED',
  );
  const past = appointments.filter((a) => new Date(a.start).getTime() < now);

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground text-sm mt-1">View and manage all bookings.</p>
        </div>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <AppointmentsClient
      upcoming={upcoming}
      past={past}
      token={token ?? ''}
    />
  );
}

import { Suspense } from 'react';
import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { APPOINTMENTS_LABEL } from '@/lib/dashboard-nav';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { AppointmentsClient, type AppointmentData } from './appointments-client';

function AppointmentsFallback() {
  return (
    <div className="dashboard-page-flow space-y-6">
      <DashboardPageHeader
        title={APPOINTMENTS_LABEL}
        variant="violet"
        subtitle="View and manage all bookings."
      />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

async function AppointmentsPageContent() {
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
      <div className="dashboard-page-flow space-y-6">
        <DashboardPageHeader
          title={APPOINTMENTS_LABEL}
          variant="violet"
          subtitle="View and manage all bookings."
        />
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

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<AppointmentsFallback />}>
      <AppointmentsPageContent />
    </Suspense>
  );
}

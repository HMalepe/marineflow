import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { AppointmentsClient, type AppointmentData } from '@/app/(dashboard)/appointments/appointments-client';

export default async function BranchAppointmentsPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const token = await getToken();
  const { branchId } = await params;
  let appointments: AppointmentData[] = [];
  let error: string | null = null;

  try {
    const data = await apiFetch<{ appointments: AppointmentData[] }>(
      `/appointments?branchId=${encodeURIComponent(branchId)}`,
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
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <AppointmentsClient
      upcoming={upcoming}
      past={past}
      token={token ?? ''}
      branchId={branchId}
      hidePageHeader
    />
  );
}

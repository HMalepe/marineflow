import { WaivePenaltyButton } from './waive-penalty-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type NoShowRisk = 'LOW' | 'MEDIUM' | 'HIGH';

/** Mirror of backend ACTIONABLE_APPOINTMENT_STATUSES — badge only on live bookings. */
const ACTIONABLE_STATUSES = new Set([
  'CONFIRMED',
  'CONFIRMED_PAID',
  'HELD',
  'PENDING_PAYMENT',
]);

interface Appointment {
  id: string;
  start: string;
  end: string;
  status: string;
  service: { name: string };
  staff: { name: string };
  customer: {
    displayName: string | null;
    waId: string;
    noShowRisk?: NoShowRisk;
    noShowCount?: number;
    bookingCount?: number;
  };
}

function shouldShowRiskBadge(appt: Appointment): boolean {
  const risk = appt.customer.noShowRisk ?? 'LOW';
  return (
    (risk === 'MEDIUM' || risk === 'HIGH') &&
    ACTIONABLE_STATUSES.has(appt.status)
  );
}

function riskSummary(noShowCount: number, bookingCount: number): string {
  return `Based on ${noShowCount} no-show${noShowCount === 1 ? '' : 's'} from ${bookingCount} booking${bookingCount === 1 ? '' : 's'}`;
}

export default async function AppointmentsPage() {
  const token = await getToken();
  let appointments: Appointment[] = [];
  let error: string | null = null;

  try {
    const data = await apiFetch<{ appointments: Appointment[] }>(
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
        <p className="text-muted-foreground text-sm mt-1">View and manage all bookings.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Upcoming ({upcoming.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 && (
            <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
          )}
          <div className="space-y-3">
            {upcoming.map((appt) => (
              <AppointmentRow key={appt.id} appt={appt} showRisk token={token ?? ''} />
            ))}
          </div>
        </CardContent>
      </Card>

      {past.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past ({past.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {past.slice(0, 20).map((appt) => (
                <AppointmentRow key={appt.id} appt={appt} />
              ))}
              {past.length > 20 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Showing 20 of {past.length} past appointments
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NoShowRiskBadge({
  risk,
  noShowCount,
  bookingCount,
}: {
  risk: NoShowRisk;
  noShowCount: number;
  bookingCount: number;
}) {
  const label = risk === 'HIGH' ? 'High risk' : 'Confirm?';
  const className =
    risk === 'HIGH'
      ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900'
      : 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900';

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${className}`}
      >
        {label}
      </span>
      <p className="text-[10px] text-muted-foreground leading-tight text-right max-w-[160px]">
        {riskSummary(noShowCount, bookingCount)}
      </p>
    </div>
  );
}

function AppointmentRow({
  appt,
  showRisk = false,
  token = '',
}: {
  appt: Appointment;
  showRisk?: boolean;
  token?: string;
}) {
  const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    CONFIRMED: 'default',
    CONFIRMED_PAID: 'default',
    HELD: 'secondary',
    PENDING_PAYMENT: 'secondary',
    CANCELLED: 'destructive',
    NO_SHOW: 'destructive',
    COMPLETED: 'secondary',
    RESCHEDULED: 'outline',
  };

  const risk = appt.customer.noShowRisk ?? 'LOW';
  const noShowCount = appt.customer.noShowCount ?? 0;
  const bookingCount = appt.customer.bookingCount ?? 0;
  const showBadge = showRisk && shouldShowRiskBadge(appt);

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="space-y-1 min-w-0 pr-3">
        <p className="text-sm font-medium truncate">
          {appt.customer.displayName ?? appt.customer.waId}
        </p>
        <p className="text-xs text-muted-foreground">
          {appt.service.name} with {appt.staff.name}
        </p>
      </div>
      <div className="text-right space-y-1 shrink-0">
        <p className="text-sm whitespace-nowrap">
          {new Date(appt.start).toLocaleDateString('en-ZA', {
            day: 'numeric',
            month: 'short',
          })}{' '}
          {new Date(appt.start).toLocaleTimeString('en-ZA', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <div className="flex flex-col items-end gap-1">
          {showRisk && token && ACTIONABLE_STATUSES.has(appt.status) && (
            <WaivePenaltyButton appointmentId={appt.id} token={token} />
          )}
          {showBadge && (
            <NoShowRiskBadge risk={risk} noShowCount={noShowCount} bookingCount={bookingCount} />
          )}
          <Badge variant={statusColors[appt.status] ?? 'secondary'}>
            {appt.status.toLowerCase().replace(/_/g, ' ')}
          </Badge>
        </div>
      </div>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

interface Appointment {
  id: string;
  start: string;
  end: string;
  status: string;
  service: { name: string };
  staff: { name: string };
  customer: { displayName: string | null; waId: string };
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

  const upcoming = appointments.filter((a) => new Date(a.start) >= new Date());
  const past = appointments.filter((a) => new Date(a.start) < new Date());

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
              <AppointmentRow key={appt.id} appt={appt} />
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

function AppointmentRow({ appt }: { appt: Appointment }) {
  const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    CONFIRMED: 'default',
    CONFIRMED_PAID: 'default',
    HELD: 'secondary',
    PENDING_PAYMENT: 'secondary',
    CANCELLED: 'destructive',
    NO_SHOW: 'destructive',
    COMPLETED: 'outline',
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {appt.customer.displayName ?? appt.customer.waId}
        </p>
        <p className="text-xs text-muted-foreground">
          {appt.service.name} with {appt.staff.name}
        </p>
      </div>
      <div className="text-right space-y-1">
        <p className="text-sm">
          {new Date(appt.start).toLocaleDateString('en-ZA', {
            day: 'numeric',
            month: 'short',
          })}{' '}
          {new Date(appt.start).toLocaleTimeString('en-ZA', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <Badge variant={statusColors[appt.status] ?? 'secondary'}>
          {appt.status.toLowerCase().replace(/_/g, ' ')}
        </Badge>
      </div>
    </div>
  );
}

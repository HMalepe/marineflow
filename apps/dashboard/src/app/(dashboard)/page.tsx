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

export default async function OverviewPage() {
  const token = await getToken();
  let appointments: Appointment[] = [];
  let error: string | null = null;

  try {
    const data = await apiFetch<{ appointments: Appointment[] }>(
      '/appointments/today',
      {},
      token,
    );
    appointments = data.appointments;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load';
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Today&apos;s overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Today's Appointments" value={appointments.length} />
        <StatCard
          title="Confirmed"
          value={appointments.filter((a) => a.status === 'CONFIRMED' || a.status === 'CONFIRMED_PAID').length}
        />
        <StatCard
          title="Pending"
          value={appointments.filter((a) => a.status === 'HELD' || a.status === 'PENDING_PAYMENT').length}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && appointments.length === 0 && (
            <p className="text-sm text-muted-foreground">No appointments today.</p>
          )}
          {appointments.length > 0 && (
            <div className="space-y-3">
              {appointments.map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
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
                      {new Date(appt.start).toLocaleTimeString('en-ZA', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <Badge variant={appt.status === 'CONFIRMED' ? 'default' : 'secondary'}>
                      {appt.status.toLowerCase().replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

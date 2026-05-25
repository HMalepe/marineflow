import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

interface CustomerDetail {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  waId: string | null;
  createdAt: string;
  loyaltyStamps: number;
  appointments: AppointmentSummary[];
  messages: MessageSummary[];
}

interface AppointmentSummary {
  id: string;
  start: string;
  status: string;
  serviceName: string;
  staffName: string;
}

interface MessageSummary {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
  createdAt: string;
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const token = await getToken();
  const { id } = await params;

  const customer = await apiFetch<CustomerDetail>(`/customers/${id}`, {}, token);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
          {(customer.firstName?.[0] ?? '').toUpperCase()}
          {(customer.lastName?.[0] ?? '').toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {customer.displayName ?? `${customer.firstName} ${customer.lastName}`}
          </h1>
          <div className="flex gap-4 text-sm text-muted-foreground mt-1">
            {customer.email && <span>{customer.email}</span>}
            {customer.waId && <span className="font-mono">{customer.waId}</span>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Visits"
          value={customer.appointments.filter((a) => a.status === 'COMPLETED').length}
        />
        <StatCard label="Loyalty Stamps" value={customer.loyaltyStamps} />
        <StatCard
          label="Customer Since"
          value={new Date(customer.createdAt).toLocaleDateString()}
        />
      </div>

      {/* Appointment History */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Appointment History</h2>
        {customer.appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No appointments yet.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Service</th>
                  <th className="text-left p-3 font-medium">Staff</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customer.appointments.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3">{new Date(a.start).toLocaleDateString()}</td>
                    <td className="p-3">{a.serviceName}</td>
                    <td className="p-3">{a.staffName}</td>
                    <td className="p-3">
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Messages */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Messages</h2>
        {customer.messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {customer.messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg px-4 py-2 max-w-[80%] text-sm ${
                  m.direction === 'INBOUND'
                    ? 'bg-muted self-start'
                    : 'bg-primary/10 ml-auto text-right'
                }`}
              >
                <p>{m.body}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(m.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded-lg p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-700',
    CONFIRMED: 'bg-blue-100 text-blue-700',
    CANCELLED: 'bg-red-100 text-red-700',
    NO_SHOW: 'bg-amber-100 text-amber-700',
    PENDING_PAYMENT: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-muted'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

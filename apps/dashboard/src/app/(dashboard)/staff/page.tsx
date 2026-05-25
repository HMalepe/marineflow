import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  role: string;
  active: boolean;
  createdAt: string;
}

export default async function StaffPage() {
  const token = await getToken();
  let staff: StaffMember[] = [];
  let error: string | null = null;

  try {
    const data = await apiFetch<{ staff: StaffMember[] }>(
      '/staff',
      {},
      token,
    );
    staff = data.staff;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load';
  }

  const active = staff.filter((s) => s.active);
  const inactive = staff.filter((s) => !s.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Staff</h2>
          <p className="text-muted-foreground">
            {active.length} active member{active.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {staff.length === 0 && (
            <p className="text-sm text-muted-foreground">No staff members found.</p>
          )}
          <div className="space-y-3">
            {active.map((member) => (
              <StaffRow key={member.id} member={member} />
            ))}
            {inactive.map((member) => (
              <StaffRow key={member.id} member={member} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StaffRow({ member }: { member: StaffMember }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{member.name}</p>
          {!member.active && <Badge variant="secondary">Inactive</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{member.email}</p>
      </div>
      <Badge variant="outline" className="capitalize">
        {member.role.toLowerCase()}
      </Badge>
    </div>
  );
}

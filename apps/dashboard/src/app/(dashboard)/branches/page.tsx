import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isDefault: boolean;
  createdAt: string;
  _count?: { staff: number; appointments: number };
}

export default async function BranchesPage() {
  const token = await getToken();
  let branches: Branch[] = [];
  let error: string | null = null;

  try {
    const data = await apiFetch<{ branches: Branch[] }>(
      '/branches',
      {},
      token,
    );
    branches = data.branches;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load';
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Branches</h2>
        <p className="text-muted-foreground">
          Manage your salon locations
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {branches.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No branches configured yet.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {branches.map((branch) => (
          <Card key={branch.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{branch.name}</CardTitle>
                {branch.isDefault && <Badge>Primary</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {branch.address && (
                <p className="text-sm text-muted-foreground">{branch.address}</p>
              )}
              {branch.phone && (
                <p className="text-sm text-muted-foreground">{branch.phone}</p>
              )}
              {branch._count && (
                <div className="flex gap-4 pt-2 text-xs text-muted-foreground">
                  <span>{branch._count.staff} staff</span>
                  <span>{branch._count.appointments} bookings</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

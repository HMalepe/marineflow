'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Props {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    salonId: string;
  };
}

export function SettingsForm({ user }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={user.name} readOnly className="bg-muted" />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user.email} readOnly className="bg-muted" />
        </div>
      </div>

      <Separator />

      <div className="flex items-center gap-4">
        <div>
          <p className="text-sm font-medium">Role</p>
          <Badge variant="secondary" className="mt-1">
            {user.role}
          </Badge>
        </div>
        <div>
          <p className="text-sm font-medium">Salon ID</p>
          <code className="text-xs text-muted-foreground">{user.salonId}</code>
        </div>
      </div>
    </div>
  );
}

import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { StaffClient } from './staff-client';
import type { StaffMember } from './staff-client';

export default async function StaffPage() {
  const token = await getToken();
  let staff: StaffMember[] = [];

  try {
    const data = await apiFetch<{ staff: StaffMember[] }>('/staff', {}, token);
    staff = data.staff ?? [];
  } catch {
    // rendered in client
  }

  return <StaffClient initialStaff={staff} token={token ?? ''} />;
}

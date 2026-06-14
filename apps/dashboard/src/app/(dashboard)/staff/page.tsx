import { redirect } from 'next/navigation';

/** Staff management merged into Staff Roster — keep /staff links working. */
export default function StaffPage() {
  redirect('/roster?addStaff=1');
}

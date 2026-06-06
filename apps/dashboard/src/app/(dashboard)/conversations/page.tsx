import { getToken, getUser } from '@/lib/auth';
import { ConversationsClient } from './conversations-client';

export default async function ConversationsPage() {
  const token = await getToken();
  const user = await getUser();

  return (
    <ConversationsClient
      token={token ?? ''}
      staffName={user?.name ?? 'Staff'}
    />
  );
}

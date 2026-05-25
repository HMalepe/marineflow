import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { CustomerSearch } from './customer-search';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  waId: string | null;
  createdAt: string;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const token = await getToken();
  const params = await searchParams;
  const query = params.q ?? '';

  let customers: Customer[] = [];

  if (query.length >= 2) {
    customers = await apiFetch<Customer[]>(
      `/customers/search?q=${encodeURIComponent(query)}`,
      {},
      token,
    );
  } else {
    customers = await apiFetch<Customer[]>('/customers?limit=50', {}, token);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Search and manage your customer base.
        </p>
      </div>

      <CustomerSearch initialQuery={query} />

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-left p-3 font-medium">WhatsApp</th>
              <th className="text-left p-3 font-medium">Since</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {customers.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  {query ? 'No customers found.' : 'No customers yet.'}
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-3">
                  <a href={`/customers/${c.id}`} className="font-medium hover:underline">
                    {c.displayName ?? `${c.firstName} ${c.lastName}`}
                  </a>
                </td>
                <td className="p-3 text-muted-foreground">{c.email ?? '—'}</td>
                <td className="p-3 text-muted-foreground font-mono text-xs">{c.waId ?? '—'}</td>
                <td className="p-3 text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

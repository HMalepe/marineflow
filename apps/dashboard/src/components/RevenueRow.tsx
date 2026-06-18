import Link from 'next/link';
import { StatCard } from '@/components/StatCard';
import { MonthlyRevenueBarChart } from '@/components/MiniBarChart';

export type AdminRevenueData = {
  totalGmvCents: number;
  mrrCents: number;
  avgRevenuePerTenantCents: number;
  tenantCount: number;
  topTenants: {
    salonId: string;
    name: string;
    slug: string;
    revenueCents: number;
  }[];
  revenueLast6Months: { month: string; revenueCents: number }[];
  currency: 'ZAR';
};

function formatZar(cents: number): string {
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

type Props = {
  data: AdminRevenueData;
};

export function RevenueRow({ data }: Props) {
  const chartData = data.revenueLast6Months.map((m) => ({
    month: m.month,
    revenueCents: m.revenueCents,
  }));

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Revenue</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          PayFast payment volume across the platform — super admin only.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total GMV" value={formatZar(data.totalGmvCents)} />
        <StatCard label="MRR" value={formatZar(data.mrrCents)} />
        <StatCard label="Avg Revenue / Tenant" value={formatZar(data.avgRevenuePerTenantCents)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MonthlyRevenueBarChart data={chartData} />

        {data.topTenants.length > 0 && (
          <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
            <p className="text-sm font-semibold">Top tenants by payment volume</p>
            <ol className="space-y-2">
              {data.topTenants.map((t, i) => (
                <li key={t.salonId} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground tabular-nums w-4">{i + 1}.</span>
                    <Link
                      href={`/admin/businesses/${t.salonId}`}
                      className="font-medium truncate hover:text-primary hover:underline underline-offset-2"
                    >
                      {t.name}
                    </Link>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">
                    {formatZar(t.revenueCents)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}

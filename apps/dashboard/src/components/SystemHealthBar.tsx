import { cn } from '@/lib/utils';

export type ServiceHealthStatus = 'green' | 'amber' | 'red';

export type SystemHealthData = {
  postgres_latency_ms: number;
  redis_latency_ms: number;
  twilio_webhook_success_rate_24h: number;
  active_db_connections: number;
  postgres: {
    latencyMs: number;
    activeConnections: number;
    status: ServiceHealthStatus;
  };
  redis: {
    latencyMs: number;
    status: ServiceHealthStatus;
  };
  twilio: {
    webhookSuccessRate24h: number;
    webhookErrorRate24h: number;
    status: ServiceHealthStatus;
  };
};

const STATUS_DOT: Record<ServiceHealthStatus, string> = {
  green: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]',
  amber: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]',
  red: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]',
};

function Indicator({
  label,
  status,
  detail,
}: {
  label: string;
  status: ServiceHealthStatus;
  detail: string;
}) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg border bg-background/80 px-3 py-1.5"
      title={detail}
    >
      <span
        className={cn('size-2.5 rounded-full shrink-0', STATUS_DOT[status])}
        aria-hidden
      />
      <span className="text-xs font-medium">{label}</span>
      <span className="text-[10px] text-muted-foreground hidden sm:inline tabular-nums">
        {detail}
      </span>
    </div>
  );
}

type Props = {
  data: SystemHealthData;
};

export function SystemHealthBar({ data }: Props) {
  const twilioPct = Math.round(data.twilio.webhookSuccessRate24h * 1000) / 10;

  return (
    <div className="rounded-xl border bg-muted/30 px-4 py-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">System health</p>
        <div className="flex flex-wrap gap-2">
          <Indicator
            label="Postgres"
            status={data.postgres.status}
            detail={`${data.postgres.latencyMs}ms · ${data.postgres.activeConnections} conn`}
          />
          <Indicator
            label="Redis"
            status={data.redis.status}
            detail={`${data.redis.latencyMs}ms`}
          />
          <Indicator
            label="Twilio"
            status={data.twilio.status}
            detail={`${twilioPct}% success (24h)`}
          />
        </div>
      </div>
    </div>
  );
}

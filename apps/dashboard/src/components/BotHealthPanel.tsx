import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Bot, XCircle } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type BotHealthData = {
  messagesInToday: number;
  messagesOutToday: number;
  failedToday: number;
  unhandledToday: number;
  webhookErrorRate24h: number;
  activeSessions: number;
};

const ERROR_RATE_ALERT_THRESHOLD = 0.05;

type Props = {
  data: BotHealthData;
};

export function BotHealthPanel({ data }: Props) {
  const errorRatePct = data.webhookErrorRate24h * 100;
  const showAlert = data.webhookErrorRate24h > ERROR_RATE_ALERT_THRESHOLD;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Bot className="size-4 text-primary" />
            Bot Health
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            WhatsApp delivery telemetry — super admin only.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="tabular-nums">
            {data.activeSessions} active session{data.activeSessions !== 1 ? 's' : ''}
          </Badge>
          {showAlert && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="size-3" />
              Error rate {errorRatePct.toFixed(1)}% (24h)
            </Badge>
          )}
        </div>
      </div>

      {showAlert && (
        <div
          className={cn(
            'rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive',
          )}
          role="alert"
        >
          Webhook error rate is above 5% in the last 24 hours — check Twilio logs and platform inbox.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Messages in today"
          value={data.messagesInToday}
          badge={
            <ArrowDownLeft className="absolute top-3 right-3 size-4 text-muted-foreground/50" />
          }
        />
        <StatCard
          label="Messages out today"
          value={data.messagesOutToday}
          badge={
            <ArrowUpRight className="absolute top-3 right-3 size-4 text-muted-foreground/50" />
          }
        />
        <StatCard
          label="Failed today"
          value={data.failedToday}
          className={data.failedToday > 0 ? 'border-destructive/40' : undefined}
          badge={
            <XCircle
              className={cn(
                'absolute top-3 right-3 size-4',
                data.failedToday > 0 ? 'text-destructive/70' : 'text-muted-foreground/50',
              )}
            />
          }
        />
        <StatCard
          label="Unhandled today"
          value={data.unhandledToday}
          className={data.unhandledToday > 0 ? 'border-amber-500/40' : undefined}
        />
      </div>
    </section>
  );
}

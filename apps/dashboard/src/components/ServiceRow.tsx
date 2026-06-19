import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';

export interface ServiceRowData {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMin: number;
  bufferMin: number;
  active: boolean;
  sortOrder: number;
  category?: { id: string; name: string } | null;
  aftercareNote?: string | null;
}

function formatPrice(cents: number): string {
  return `R ${(cents / 100).toFixed(2)}`;
}

function formatDuration(service: ServiceRowData): string {
  if (service.bufferMin > 0) {
    return `${service.durationMin} + ${service.bufferMin} min buffer`;
  }
  return `${service.durationMin} min`;
}

export function formatRevPerHour(priceCents: number, durationMin: number): string {
  if (durationMin < 1) return '—';
  const randsPerHour = (priceCents / 100 / durationMin) * 60;
  return `R ${Math.round(randsPerHour)}/hr`;
}

interface ServiceRowProps {
  service: ServiceRowData;
  bookings30d: number;
  showIntelColumns: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  togglingId: string | null;
  onToggleActive: (service: ServiceRowData, e: React.MouseEvent) => void;
  onEdit: (service: ServiceRowData) => void;
  onDelete: (service: ServiceRowData) => void;
}

export function ServiceRow({
  service,
  bookings30d,
  showIntelColumns,
  selected,
  onToggleSelect,
  onMoveUp,
  onMoveDown,
  togglingId,
  onToggleActive,
  onEdit,
  onDelete,
}: ServiceRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 group/row hover:bg-muted/30 transition-colors',
        !service.active && 'opacity-60',
        selected && 'bg-primary/5',
      )}
    >
      <input
        type="checkbox"
        className="size-4 accent-primary shrink-0"
        checked={selected}
        onChange={() => onToggleSelect(service.id)}
        aria-label={`Select ${service.name}`}
      />

      <div className="flex flex-col gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          title="Move up"
          onClick={onMoveUp}
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronUp className="size-3" />
        </button>
        <button
          type="button"
          title="Move down"
          onClick={onMoveDown}
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className="size-3" />
        </button>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{service.name}</span>
          {!service.active && (
            <Badge variant="secondary" className="text-[10px]">
              Hidden
            </Badge>
          )}
          {showIntelColumns && bookings30d === 0 && (
            <Badge variant="secondary" className="text-[10px] text-muted-foreground">
              0 bookings in 30d
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{formatDuration(service)}</p>
      </div>

      {showIntelColumns && (
        <>
          <span
            className="text-xs tabular-nums text-muted-foreground shrink-0 hidden md:block w-16 text-right"
            title="Bookings in the last 30 days"
          >
            {bookings30d}
          </span>
          <span
            className="text-xs font-mono text-muted-foreground shrink-0 hidden lg:block w-20 text-right"
            title="Revenue per hour (price ÷ duration)"
          >
            {formatRevPerHour(service.priceCents, service.durationMin)}
          </span>
        </>
      )}

      <span className="text-sm font-mono text-muted-foreground shrink-0 hidden sm:block">
        {formatPrice(service.priceCents)}
      </span>

      <Button
        variant="outline"
        size="sm"
        disabled={togglingId === service.id}
        onClick={(e) => onToggleActive(service, e)}
        className={cn(
          'shrink-0 h-7 text-xs',
          service.active
            ? 'border-green-600/30 text-green-700 dark:text-green-400'
            : 'text-muted-foreground',
        )}
      >
        {togglingId === service.id ? '…' : service.active ? 'Active' : 'Inactive'}
      </Button>

      <button
        type="button"
        onClick={() => onEdit(service)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 rounded hover:bg-muted transition-colors shrink-0 opacity-0 group-hover/row:opacity-100 focus:opacity-100"
        title="Edit service"
      >
        <Pencil className="size-3" />
        Edit
      </button>

      <button
        type="button"
        onClick={() => onDelete(service)}
        className="text-xs text-muted-foreground hover:text-destructive px-1.5 py-1 rounded hover:bg-muted transition-colors shrink-0 opacity-0 group-hover/row:opacity-100 focus:opacity-100"
        title="Delete service"
      >
        Delete
      </button>
    </div>
  );
}

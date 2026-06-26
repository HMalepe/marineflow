'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Lock, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CollapsibleSection } from '@/components/collapsible-section';
import { SectionSaveFeedback } from '@/components/save-feedback';
import { useMultiSectionSaveFeedback } from '@/lib/use-save-feedback';
import {
  BUILTIN_FLOW_DEFS,
  LOCKED_FLOW_KEYS,
  buildFlowItems,
  newCustomFlowId,
  orderFromItems,
  type BuiltinFlowKey,
  type CustomBotFlow,
  type FlowItem,
} from '@/lib/bot-flow-settings';
import { cn } from '@/lib/utils';
import { saveBotFlowSettings, type SalonSettings } from './actions';

interface Props {
  initialSettings: SalonSettings;
  onSaved: (salon: SalonSettings) => void;
}

type FlagState = Record<BuiltinFlowKey, boolean>;

function flagsFromSettings(s: SalonSettings): FlagState {
  return {
    botAskMarketingConsent: s.botAskMarketingConsent ?? true,
    botAllowStaffPick: s.botAllowStaffPick ?? true,
    botLoyaltyEnabled: s.botLoyaltyEnabled ?? true,
    botRequirePaymentStep: s.botRequirePaymentStep ?? true,
    botWinbackEnabled: s.botWinbackEnabled ?? true,
    botBirthdayEnabled: s.botBirthdayEnabled ?? true,
  };
}

function SortableFlowCard({
  item,
  index,
  enabled,
  locked,
  onToggle,
  onRemove,
  onUpdateCustom,
}: {
  item: FlowItem;
  index: number;
  enabled: boolean;
  locked?: boolean;
  onToggle: (checked: boolean) => void;
  onRemove?: () => void;
  onUpdateCustom?: (patch: Partial<Pick<CustomBotFlow, 'label' | 'prompt'>>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCustom = item.type === 'custom';
  const label = isCustom ? item.flow.label : BUILTIN_FLOW_DEFS.find((d) => d.key === item.id)?.label ?? item.id;
  const description = isCustom
    ? item.flow.prompt || 'Custom step — add a prompt so your team knows what the bot should ask.'
    : BUILTIN_FLOW_DEFS.find((d) => d.key === item.id)?.description ?? '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-xl border bg-card shadow-sm transition-shadow',
        isDragging && 'shadow-lg ring-2 ring-ring/30 z-10 opacity-95',
        !enabled && 'opacity-75',
        locked && 'opacity-60 bg-muted/40',
        isCustom && 'border-dashed border-primary/30',
      )}
    >
      <div className="flex gap-2 p-4">
        <button
          type="button"
          className="mt-0.5 shrink-0 touch-none cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label={`Drag to reorder step ${index + 1}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-5" />
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => !locked && onToggle(e.target.checked)}
              disabled={locked}
              className="mt-1 size-4 rounded border-input accent-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={locked ? `${label} (temporarily disabled)` : `Enable ${label}`}
            />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Step {index + 1}
                </span>
                {locked && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                    <Lock className="size-3" />
                    Temporarily off
                  </span>
                )}
                {isCustom && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    <Sparkles className="size-3" />
                    Custom
                  </span>
                )}
              </div>

              {isCustom && onUpdateCustom ? (
                <div className="space-y-2 pt-1">
                  <div className="space-y-1">
                    <Label htmlFor={`flow-label-${item.id}`} className="text-xs text-muted-foreground">
                      Flow label
                    </Label>
                    <Input
                      id={`flow-label-${item.id}`}
                      value={item.flow.label}
                      onChange={(e) => onUpdateCustom({ label: e.target.value })}
                      placeholder="e.g. Ask about allergies"
                      maxLength={80}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`flow-prompt-${item.id}`} className="text-xs text-muted-foreground">
                      Bot prompt
                    </Label>
                    <textarea
                      id={`flow-prompt-${item.id}`}
                      value={item.flow.prompt}
                      onChange={(e) => onUpdateCustom({ prompt: e.target.value })}
                      placeholder="What should the bot say or ask at this step?"
                      maxLength={500}
                      rows={2}
                      className={cn(
                        'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y min-h-[60px]',
                        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30',
                      )}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium leading-snug">{label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                </>
              )}
            </div>

            {isCustom && onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Remove custom flow"
                onClick={onRemove}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConversationFlowSection({ initialSettings, onSaved }: Props) {
  const { getSection, reportSuccess, reportError } = useMultiSectionSaveFeedback();
  const [saved, setSaved] = useState(initialSettings);
  const [flags, setFlags] = useState<FlagState>(() => flagsFromSettings(initialSettings));
  const [customFlows, setCustomFlows] = useState<CustomBotFlow[]>(
    () => initialSettings.botCustomFlows ?? [],
  );
  const [items, setItems] = useState<FlowItem[]>(() =>
    buildFlowItems(
      initialSettings.botFlowOrder ?? BUILTIN_FLOW_DEFS.map((d) => d.key),
      flagsFromSettings(initialSettings),
      initialSettings.botCustomFlows ?? [],
    ),
  );
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newPrompt, setNewPrompt] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  const dirty = useMemo(() => {
    const savedFlags = flagsFromSettings(saved);
    const flagsChanged = (Object.keys(flags) as BuiltinFlowKey[]).some((k) => flags[k] !== savedFlags[k]);
    const orderChanged =
      JSON.stringify(orderFromItems(items)) !==
      JSON.stringify(saved.botFlowOrder ?? BUILTIN_FLOW_DEFS.map((d) => d.key));
    const customChanged =
      JSON.stringify(customFlows) !== JSON.stringify(saved.botCustomFlows ?? []);
    return flagsChanged || orderChanged || customChanged;
  }, [flags, items, customFlows, saved]);

  const isEnabled = useCallback(
    (item: FlowItem) => {
      if (item.type === 'custom') return item.flow.enabled;
      return flags[item.id];
    },
    [flags],
  );

  const setEnabled = useCallback((item: FlowItem, checked: boolean) => {
    if (item.type === 'custom') {
      setCustomFlows((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, enabled: checked } : f)),
      );
      setItems((prev) =>
        prev.map((i) =>
          i.type === 'custom' && i.id === item.id ? { ...i, flow: { ...i.flow, enabled: checked } } : i,
        ),
      );
      return;
    }
    setFlags((prev) => ({ ...prev, [item.id]: checked }));
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id);
      const newIndex = prev.findIndex((i) => i.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function addCustomFlow() {
    const label = newLabel.trim();
    if (!label) {
      reportError('botBehaviour', 'Add a flow label for your custom step');
      return;
    }
    const flow: CustomBotFlow = {
      id: newCustomFlowId(),
      label,
      prompt: newPrompt.trim(),
      enabled: true,
    };
    setCustomFlows((prev) => [...prev, flow]);
    setItems((prev) => [...prev, { type: 'custom', id: flow.id, flow }]);
    setNewLabel('');
    setNewPrompt('');
  }

  function removeCustomFlow(id: string) {
    setCustomFlows((prev) => prev.filter((f) => f.id !== id));
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateCustomFlow(id: string, patch: Partial<Pick<CustomBotFlow, 'label' | 'prompt'>>) {
    setCustomFlows((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
    setItems((prev) =>
      prev.map((i) =>
        i.type === 'custom' && i.id === id ? { ...i, flow: { ...i.flow, ...patch } } : i,
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (const flow of customFlows) {
      if (!flow.label.trim()) {
        reportError('botBehaviour', 'Every custom flow needs a label');
        return;
      }
    }

    setSaving(true);
    try {
      const result = await saveBotFlowSettings({
        ...flags,
        botFlowOrder: orderFromItems(items),
        botCustomFlows: customFlows.map((f) => ({
          ...f,
          label: f.label.trim(),
          prompt: f.prompt.trim(),
        })),
      });
      if (result.salon) {
        setSaved(result.salon);
        onSaved(result.salon);
        reportSuccess('botBehaviour', 'Conversation flow saved');
      } else {
        reportError('botBehaviour', result.error ?? 'Save failed');
      }
    } catch {
      reportError('botBehaviour', 'Save failed — please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <CollapsibleSection
      id="settings-conversation-flow"
      title="Conversation flow"
      subtitle="Drag steps into the order customers experience them. Toggle steps on or off, or add your own custom prompts."
    >
      {LOCKED_FLOW_KEYS.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800/40 dark:bg-yellow-900/20 dark:text-yellow-300">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>
            Some steps are <strong>temporarily disabled</strong> to keep the booking chatbot running
            smoothly. They are greyed out below and cannot be toggled.
          </p>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 max-w-2xl">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((item, index) => (
                <SortableFlowCard
                  key={item.id}
                  item={item}
                  index={index}
                  enabled={isEnabled(item)}
                  locked={item.type === 'builtin' && (LOCKED_FLOW_KEYS as readonly string[]).includes(item.id)}
                  onToggle={(checked) => setEnabled(item, checked)}
                  onRemove={item.type === 'custom' ? () => removeCustomFlow(item.id) : undefined}
                  onUpdateCustom={
                    item.type === 'custom'
                      ? (patch) => updateCustomFlow(item.id, patch)
                      : undefined
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="rounded-xl border border-dashed p-4 space-y-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-primary" />
            <p className="text-sm font-medium">Add custom flow step</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="new-flow-label">Flow label</Label>
              <Input
                id="new-flow-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Skin consultation question"
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="new-flow-prompt">Bot prompt (optional)</Label>
              <textarea
                id="new-flow-prompt"
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="The message or question your bot should send at this step…"
                maxLength={500}
                rows={2}
                className={cn(
                  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y min-h-[72px]',
                  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30',
                )}
              />
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addCustomFlow}>
            <Plus className="size-3.5 mr-1.5" />
            Add step
          </Button>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save flow settings'}
            </Button>
            {dirty && (
              <span className="text-xs text-yellow-700 dark:text-yellow-400">Unsaved changes</span>
            )}
          </div>
          <SectionSaveFeedback feedback={getSection('botBehaviour')} />
        </div>
      </form>
    </CollapsibleSection>
  );
}

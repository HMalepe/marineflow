'use client';

import { CollapsibleSection } from '@/components/collapsible-section';
import {
  SetupHealthScorePanel,
  useSetupHealthState,
  type SetupHealthData,
} from '@/components/SetupHealthScore';

type Props = {
  data: SetupHealthData;
};

export function SetupHealthSection({ data }: Props) {
  const { shouldShowSection, visibleChecks, attentionCount, dismiss } =
    useSetupHealthState(data);

  if (!shouldShowSection) {
    return null;
  }

  const severity = data.score < 40 ? 'critical' : 'warning';
  const collapsedAttention =
    attentionCount > 0
      ? {
          count: attentionCount,
          label:
            visibleChecks.length > 0
              ? `${visibleChecks.length} setup ${visibleChecks.length === 1 ? 'item' : 'items'} need action`
              : 'Setup reminders dismissed — review when you can',
          severity: severity as 'warning' | 'critical',
        }
      : undefined;

  return (
    <CollapsibleSection
      id="overview-setup-health"
      title="Setup health"
      collapsedAttention={collapsedAttention}
    >
      <SetupHealthScorePanel
        data={data}
        visibleChecks={visibleChecks}
        onDismiss={dismiss}
      />
    </CollapsibleSection>
  );
}

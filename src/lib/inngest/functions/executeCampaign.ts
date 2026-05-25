import { inngest } from '../client.js';
import { withTenantContext } from '../../db/tenantSession.js';
import { prisma } from '../../prisma.js';

export const executeScheduledCampaign = inngest.createFunction(
  {
    id: 'execute-scheduled-campaign',
    retries: 1,
    triggers: [{ event: 'campaign/scheduled' }],
  },
  async ({ event }: { event: { data: { campaignId: string; salonId: string } } }) => {
    const { campaignId, salonId } = event.data;

    await withTenantContext(salonId, async () => {
      const { executeCampaign } = await import('../../../services/campaigns.js');
      return executeCampaign(campaignId);
    });
  },
);

export const checkScheduledCampaigns = inngest.createFunction(
  {
    id: 'check-scheduled-campaigns',
    triggers: [{ cron: '*/5 * * * *' }],
  },
  async () => {
    const due = await prisma.campaign.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: new Date() },
      },
    });

    for (const campaign of due) {
      await inngest.send({
        name: 'campaign/scheduled',
        data: { campaignId: campaign.id, salonId: campaign.salonId },
      });
    }

    return { checked: due.length };
  },
);

import { inngest } from '../client.js';
import { Prisma } from '@prisma/client';
import { withTenantContext } from '../../db/tenantSession.js';
import { prisma } from '../../prisma.js';
import { logger } from '../../logger.js';

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
    let due;
    try {
      due = await prisma.campaign.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lte: new Date() },
        },
      });
    } catch (err) {
      // P2021 = table not yet created (migration pending) — skip silently
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
        logger.debug('checkScheduledCampaigns: Campaign table not yet available, skipping');
        return { checked: 0 };
      }
      throw err;
    }

    for (const campaign of due) {
      await inngest.send({
        name: 'campaign/scheduled',
        data: { campaignId: campaign.id, salonId: campaign.salonId },
      });
    }

    return { checked: due.length };
  },
);

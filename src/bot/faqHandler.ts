import type { Conversation, Customer, Salon } from '@prisma/client';
import { getTenantDb } from '../lib/db/tenantSession.js';
import { logMessageLog } from '../services/messageLog.js';
import { buildFaqListInteractive } from '../services/botInteractiveMenus.js';
import { isBackToMainMenuCommand } from '../lib/botNavigation.js';
import type { InteractiveMessage } from '../lib/integrations/messaging/types.js';

type FaqConv = Conversation & { customer: Customer; salon: Salon };

/** Record that a FAQ answer was served (for dashboard performance stats). */
export function logFaqServed(salonId: string, faqId: string): void {
  logMessageLog({
    salonId,
    faqId,
    direction: 'OUTBOUND',
    status: 'DELIVERED',
  });
}

export async function handleFaq(
  conv: FaqConv,
  text: string,
  deps: {
    goBackToMainMenu: (conv: FaqConv) => Promise<void>;
    reply: (conv: FaqConv, body: string) => Promise<void>;
    replyMaybeInteractive: (
      conv: FaqConv,
      body: string,
      interactive?: InteractiveMessage | null,
    ) => Promise<void>;
  },
): Promise<void> {
  if (isBackToMainMenuCommand(text)) {
    await deps.goBackToMainMenu(conv);
    return;
  }

  const n = parseInt(text, 10);
  const faqs = await getTenantDb().faqItem.findMany({
    where: { salonId: conv.salonId, status: 'APPROVED' },
    orderBy: { sortOrder: 'asc' },
    take: 10,
  });

  if (Number.isFinite(n) && n >= 1 && n <= faqs.length) {
    const f = faqs[n - 1]!;
    logFaqServed(conv.salonId, f.id);
    const answer = f.answer.length > 3900 ? f.answer.slice(0, 3900) + '…' : f.answer;
    const faqBody = `${f.question}\n\n${answer}\n\nReply with another number, ask a question, or BACK.`;
    await deps.replyMaybeInteractive(conv, faqBody, buildFaqListInteractive(faqs, conv.salon));
    return;
  }

  try {
    const { semanticSearch } = await import('../lib/integrations/ai/index.js');
    const { synthesizeFaqAnswer } = await import('../services/botAssistant.js');
    const results = await semanticSearch(conv.salonId, text, { limit: 3, threshold: 0.65 });
    if (results.length > 0) {
      const topFaq = results.find((r) => r.source === 'faq' && r.faqItemId);
      if (topFaq?.faqItemId) {
        logFaqServed(conv.salonId, topFaq.faqItemId);
      }
      const chunks = results.map((r) => r.content);
      const synthesized = await synthesizeFaqAnswer(conv.salon, text, chunks);
      const answer = synthesized ?? results[0]!.content;
      const truncated = answer.length > 3900 ? answer.slice(0, 3900) + '…' : answer;
      await deps.reply(conv, `${truncated}\n\nReply with a FAQ number, ask another question, or BACK.`);
      return;
    }
  } catch {
    // AI unavailable — fall through
  }

  const faqRepromptBody = "I couldn't find an answer. Pick a FAQ number, ask differently, or reply BACK.";
  await deps.replyMaybeInteractive(conv, faqRepromptBody, buildFaqListInteractive(faqs, conv.salon));
}

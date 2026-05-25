import { env } from '../../../config.js';
import type { MessagingProvider } from './types.js';
import { twilioMessaging } from './twilio-impl.js';
import { whatsappCloudMessaging } from './whatsapp-cloud-impl.js';

export type { MessagingProvider, NormalisedInboundMessage, SentMessage } from './types.js';

export const messaging: MessagingProvider =
  env.MESSAGING_PROVIDER === 'meta' ? whatsappCloudMessaging : twilioMessaging;

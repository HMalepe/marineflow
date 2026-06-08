import { Inngest } from 'inngest';
import { env } from '../../config.js';

/** Dev server when developing locally; cloud mode when signing key is present. */
export const inngestIsDev =
  env.INNGEST_DEV === true ||
  (env.NODE_ENV !== 'production' && !env.INNGEST_SIGNING_KEY);

export const inngest = new Inngest({
  id: 'marineflow',
  ...(inngestIsDev ? { isDev: true } : {}),
  ...(env.INNGEST_EVENT_KEY ? { eventKey: env.INNGEST_EVENT_KEY } : {}),
  ...(env.INNGEST_SIGNING_KEY ? { signingKey: env.INNGEST_SIGNING_KEY } : {}),
});

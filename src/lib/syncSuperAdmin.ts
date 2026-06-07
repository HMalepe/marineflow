import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

const SUPER_ADMIN_EMAIL = 'holiday.malepe@gmail.com';

/** Keep super admin password in sync with SUPER_ADMIN_PASSWORD on deploy/restart. */
export async function syncSuperAdminPasswordFromEnv(): Promise<void> {
  const password = process.env.SUPER_ADMIN_PASSWORD?.trim();
  if (!password) return;

  try {
    const user = await prisma.staffUser.findUnique({
      where: { email: SUPER_ADMIN_EMAIL },
    });

    if (!user) {
      logger.warn(
        { email: SUPER_ADMIN_EMAIL },
        'super_admin_sync_skipped_user_missing_run_seed',
      );
      return;
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (matches && user.role === 'SUPER_ADMIN' && user.active) {
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.staffUser.update({
      where: { email: SUPER_ADMIN_EMAIL },
      data: { passwordHash, role: 'SUPER_ADMIN', active: true },
    });

    logger.info({ email: SUPER_ADMIN_EMAIL }, 'super_admin_password_synced_from_env');
  } catch (err) {
    logger.error({ err }, 'super_admin_password_sync_failed');
  }
}

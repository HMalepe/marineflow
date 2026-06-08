import bcrypt from 'bcryptjs';
import { env } from '../config.js';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

const SUPER_ADMIN_EMAIL = 'holiday.malepe@gmail.com';

/** Create or update super admin from SUPER_ADMIN_PASSWORD on deploy/restart. */
export async function syncSuperAdminPasswordFromEnv(): Promise<void> {
  const password = process.env.SUPER_ADMIN_PASSWORD?.trim();
  if (!password) {
    logger.warn('super_admin_sync_skipped_no_SUPER_ADMIN_PASSWORD');
    return;
  }

  try {
    let user = await prisma.staffUser.findUnique({
      where: { email: SUPER_ADMIN_EMAIL },
    });

    if (!user) {
      const salon =
        (await prisma.salon.findFirst({
          where: { slug: env.DEFAULT_SALON_SLUG, deletedAt: null },
        })) ??
        (await prisma.salon.findFirst({
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        }));

      if (!salon) {
        logger.warn('super_admin_bootstrap_no_salon_in_db');
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      user = await prisma.staffUser.create({
        data: {
          salonId: salon.id,
          email: SUPER_ADMIN_EMAIL,
          passwordHash,
          name: 'Holiday Malepe',
          role: 'SUPER_ADMIN',
        },
      });

      logger.info(
        { email: SUPER_ADMIN_EMAIL, salonId: salon.id },
        'super_admin_created_from_env',
      );
      return;
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (matches && user.role === 'SUPER_ADMIN' && user.active) {
      logger.info({ email: SUPER_ADMIN_EMAIL }, 'super_admin_password_already_in_sync');
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

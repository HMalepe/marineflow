import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const slug = process.env.DEFAULT_SALON_SLUG ?? 'demo-salon';

  const salon = await prisma.salon.upsert({
    where: { slug },
    create: {
      slug,
      name: 'Demo Salon',
      timezone: 'America/New_York',
      addressLine: '123 Main Street',
      parkingNotes: 'Lot behind building.',
      accessibility: 'Step-free entrance.',
      phoneDisplay: '+1 (555) 010-0199',
    },
    update: {},
  });

  const hourRows = [
    { dayOfWeek: 0, openMin: 10 * 60, closeMin: 17 * 60 },
    { dayOfWeek: 1, openMin: 9 * 60, closeMin: 18 * 60 },
    { dayOfWeek: 2, openMin: 9 * 60, closeMin: 18 * 60 },
    { dayOfWeek: 3, openMin: 9 * 60, closeMin: 18 * 60 },
    { dayOfWeek: 4, openMin: 9 * 60, closeMin: 20 * 60 },
    { dayOfWeek: 5, openMin: 9 * 60, closeMin: 18 * 60 },
    { dayOfWeek: 6, openMin: 9 * 60, closeMin: 17 * 60 },
  ];
  for (const h of hourRows) {
    await prisma.businessHour.upsert({
      where: { salonId_dayOfWeek: { salonId: salon.id, dayOfWeek: h.dayOfWeek } },
      create: { salonId: salon.id, ...h },
      update: { openMin: h.openMin, closeMin: h.closeMin },
    });
  }

  let cut = await prisma.service.findFirst({
    where: { salonId: salon.id, name: 'Haircut' },
  });
  if (!cut) {
    cut = await prisma.service.create({
      data: {
        salonId: salon.id,
        name: 'Haircut',
        durationMin: 45,
        bufferMin: 15,
        priceCents: 4500,
        category: 'cut',
        depositCents: 1000,
        qualifiesLoyalty: true,
        sortOrder: 1,
      },
    });
  }

  let color = await prisma.service.findFirst({
    where: { salonId: salon.id, name: 'Color' },
  });
  if (!color) {
    color = await prisma.service.create({
      data: {
        salonId: salon.id,
        name: 'Color',
        durationMin: 90,
        bufferMin: 30,
        priceCents: 12000,
        category: 'color',
        depositCents: 2500,
        qualifiesLoyalty: true,
        sortOrder: 2,
      },
    });
  }

  let alice = await prisma.staff.findFirst({ where: { salonId: salon.id, name: 'Alice' } });
  if (!alice) {
    alice = await prisma.staff.create({
      data: { salonId: salon.id, name: 'Alice', breakMin: 5 },
    });
  }

  let bob = await prisma.staff.findFirst({ where: { salonId: salon.id, name: 'Bob' } });
  if (!bob) {
    bob = await prisma.staff.create({
      data: { salonId: salon.id, name: 'Bob', breakMin: 5 },
    });
  }

  const links = [
    [alice.id, cut.id],
    [bob.id, cut.id],
    [alice.id, color.id],
  ] as const;
  for (const [staffId, serviceId] of links) {
    await prisma.staffService.upsert({
      where: { staffId_serviceId: { staffId, serviceId } },
      create: { staffId, serviceId },
      update: {},
    });
  }

  await prisma.loyaltyProgram.upsert({
    where: { salonId: salon.id },
    create: {
      salonId: salon.id,
      stampsPerReward: 10,
      rewardKind: 'FREE_SERVICE_TIER',
    },
    update: {},
  });

  const hash = await bcrypt.hash('demo123', 10);
  await prisma.staffUser.upsert({
    where: { email: 'owner@demo-salon.local' },
    create: {
      salonId: salon.id,
      email: 'owner@demo-salon.local',
      passwordHash: hash,
      name: 'Owner',
      role: 'OWNER',
      staffId: alice.id,
    },
    update: { passwordHash: hash },
  });

  await prisma.staffUser.upsert({
    where: { email: 'stylist@demo-salon.local' },
    create: {
      salonId: salon.id,
      email: 'stylist@demo-salon.local',
      passwordHash: hash,
      name: 'Stylist',
      role: 'STYLIST',
      staffId: bob.id,
    },
    update: { passwordHash: hash },
  });

  await prisma.faqItem.deleteMany({ where: { salonId: salon.id } });
  await prisma.faqItem.createMany({
    data: [
      {
        salonId: salon.id,
        question: 'What are your hours?',
        answer: 'We follow the schedule in our booking system — holidays may vary.',
        keywords: ['hours', 'open'],
        sortOrder: 1,
      },
      {
        salonId: salon.id,
        question: 'Do you take walk-ins?',
        answer: 'We recommend booking on WhatsApp; limited walk-in availability.',
        keywords: ['walk'],
        sortOrder: 2,
      },
    ],
  });

  const demoCust = await prisma.customer.upsert({
    where: { salonId_waId: { salonId: salon.id, waId: '+15555550100' } },
    create: { salonId: salon.id, waId: '+15555550100', displayName: 'Demo Patron' },
    update: {},
  });

  const prog = await prisma.loyaltyProgram.findUniqueOrThrow({ where: { salonId: salon.id } });
  await prisma.loyaltyLedger.deleteMany({ where: { customerId: demoCust.id } });
  await prisma.loyaltyLedger.createMany({
    data: Array.from({ length: 10 }).map(() => ({
      programId: prog.id,
      customerId: demoCust.id,
      delta: 1,
      reason: 'SEED',
    })),
  });
  await prisma.customer.update({
    where: { id: demoCust.id },
    data: { loyaltyStampsCached: 10 },
  });

  console.log('Seed OK — salon', salon.slug, '| dashboard: owner@demo-salon.local / demo123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

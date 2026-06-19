import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const slug = process.env.DEFAULT_SALON_SLUG ?? 'demo-salon';
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM?.trim();

  const salon = await prisma.salon.upsert({
    where: { slug },
    create: {
      slug,
      name: 'MarineFlow Demo',
      tradingName: 'MarineFlow',
      legalName: 'MarineFlow Pty Ltd',
      industryTemplate: 'salon',
      status: 'TRIAL',
      tier: 'starter',
      timezone: 'Africa/Johannesburg',
      defaultCurrency: 'zar',
      locale: 'en-ZA',
      botName: 'Ava',
      toneFormality: 50,
      toneWarmth: 70,
      tonePlayfulness: 40,
      tonePace: 30,
      toneSalesEnergy: 30,
      addressLine: 'Johannesburg, South Africa',
      parkingNotes: 'Lot behind building.',
      accessibility: 'Step-free entrance.',
      phoneDisplay: '+27 10 000 0000',
      ...(twilioFrom ? { twilioWhatsAppNumber: twilioFrom } : {}),
      metadata: {},
    },
    update: {
      name: 'MarineFlow Demo',
      tradingName: 'MarineFlow',
      timezone: 'Africa/Johannesburg',
      defaultCurrency: 'zar',
      locale: 'en-ZA',
      phoneDisplay: '+27 10 000 0000',
      addressLine: 'Johannesburg, South Africa',
      ...(twilioFrom ? { twilioWhatsAppNumber: twilioFrom } : {}),
    },
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

  const cutCategory = await prisma.serviceCategory.upsert({
    where: { salonId_slug: { salonId: salon.id, slug: 'cut' } },
    update: {},
    create: { salonId: salon.id, name: 'Cuts', slug: 'cut', sortOrder: 1 },
  });

  const colorCategory = await prisma.serviceCategory.upsert({
    where: { salonId_slug: { salonId: salon.id, slug: 'color' } },
    update: {},
    create: { salonId: salon.id, name: 'Color', slug: 'color', sortOrder: 2 },
  });

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
        categoryId: cutCategory.id,
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
        categoryId: colorCategory.id,
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
    update: { staffId: alice.id },
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
    update: { staffId: bob.id },
  });

  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const superAdminHash = await bcrypt.hash(superAdminPassword, 10);
  await prisma.staffUser.upsert({
    where: { email: 'holiday.malepe@gmail.com' },
    create: {
      salonId: salon.id,
      email: 'holiday.malepe@gmail.com',
      passwordHash: superAdminHash,
      name: 'Holiday Malepe',
      role: 'SUPER_ADMIN',
    },
    update: {
      name: 'Holiday Malepe',
      role: 'SUPER_ADMIN',
    },
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
  console.log(
    'SUPER_ADMIN — holiday.malepe@gmail.com /',
    process.env.SUPER_ADMIN_PASSWORD ? '(SUPER_ADMIN_PASSWORD env)' : 'ChangeMe123!',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

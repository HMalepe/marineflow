/**
 * Seeds Dr Marley Dispensary + a shared WhatsApp business router.
 *
 * Usage:
 *   npx tsx prisma/seed-bart-marley.ts
 *
 * Env (optional — DR_MARLEY_* preferred, BART_* still accepted):
 *   DR_MARLEY_OWNER_EMAIL=owner@drmarley.co.za
 *   DR_MARLEY_OWNER_PASSWORD=ChangeMeStrong1!
 *   DR_MARLEY_OWNER_NAME=Dr Marley
 *   DR_MARLEY_OWNER_PHONE=+27…          # shop WhatsApp alerts on new orders
 *   DR_MARLEY_DRIVER_PHONES=+27a,+27b   # Uber-style ACCEPT/DECLINE on shared WA number
 *   DR_MARLEY_DRIVER_NAMES=Thabo,Sipho  # optional names aligned to phones
 *   BONTLE_SLUG=bontle-entle            # existing salon slug to link
 *   TWILIO_WHATSAPP_FROM=whatsapp:+27…  # moved onto the router
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Inline defaults so this seed runs in Railway (image has no `src/`). */
const DEFAULT_RETAIL_SETTINGS = {
  alwaysOpen: true,
  deliveryEnabled: true,
  collectionEnabled: true,
  deliveryFeeCents: 5000,
  minOrderCents: 15000,
  deliveryAreaNote: 'We deliver across Joburg metro — reply with your suburb and we’ll confirm.',
  ageGateEnabled: true,
  ageGateCopy:
    '🌿 *Dr Marley Dispensary*\n\nYou must be *18+* to order cannabis products.\n\nReply *YES* to confirm you are 18 or older, or *NO* to exit.',
  deliveryEtaMinutes: 60,
  collectionEtaMinutes: 30,
  notifyStaffOnOrder: true,
  driverNotifyEnabled: false,
  driverPhones: [] as string[],
  drivers: [] as { name: string; phone: string }[],
};

/** Official Dr. Marley price list — SKUs for WhatsApp cart. */
const CANNABIS_CATALOG: {
  category: string;
  slug: string;
  items: { name: string; priceRands: number; description: string }[];
}[] = [
  {
    category: 'Greenhouse',
    slug: 'greenhouse',
    items: [
      { name: 'Greenhouse 10g', priceRands: 250, description: 'Strains: Sweet ZZ (Hybrid), Silver Haze (Sativa). Tell us your strain when you confirm.' },
      { name: 'Greenhouse 20g', priceRands: 500, description: 'Strains: Sweet ZZ (Hybrid), Silver Haze (Sativa). Tell us your strain when you confirm.' },
      { name: 'Greenhouse 50g', priceRands: 800, description: 'Strains: Sweet ZZ (Hybrid), Silver Haze (Sativa). Tell us your strain when you confirm.' },
      { name: 'Greenhouse 100g', priceRands: 1300, description: 'Strains: Sweet ZZ (Hybrid), Silver Haze (Sativa). Tell us your strain when you confirm.' },
    ],
  },
  {
    category: 'Premium Greenhouse',
    slug: 'premium-greenhouse',
    items: [
      { name: 'Premium Greenhouse 20g', priceRands: 600, description: 'Cherry Whip (Sativa), Sour Pebbles (Hybrid), Gorilla Kush (Indica). Name your strain at confirm.' },
      { name: 'Premium Greenhouse 50g', priceRands: 900, description: 'Cherry Whip (Sativa), Sour Pebbles (Hybrid), Gorilla Kush (Indica). Name your strain at confirm.' },
      { name: 'Premium Greenhouse 100g', priceRands: 1500, description: 'Cherry Whip (Sativa), Sour Pebbles (Hybrid), Gorilla Kush (Indica). Name your strain at confirm.' },
    ],
  },
  {
    category: 'Prerolls',
    slug: 'prerolls',
    items: [
      { name: 'Greenhouse Moonstick (5)', priceRands: 350, description: 'Pack of 5 greenhouse moonstick prerolls.' },
      { name: 'Tunnel Prerolls (5)', priceRands: 300, description: 'Pack of 5 tunnel prerolls.' },
      { name: 'Hash Outdoor Prerolls (5)', priceRands: 250, description: 'Pack of 5 hash outdoor prerolls.' },
    ],
  },
  {
    category: 'Indoor Special',
    slug: 'indoor-special',
    items: [
      { name: 'Fire Station Indoor 5g', priceRands: 600, description: 'Indoor special — Fire Station (Hybrid), 5g.' },
    ],
  },
  {
    category: 'Sativas',
    slug: 'sativas',
    items: [
      { name: 'Miami Heat 1g', priceRands: 150, description: 'Sativa flower — 1g.' },
      { name: 'Miami Heat 5g', priceRands: 600, description: 'Sativa flower — 5g.' },
      { name: 'Top Cherry 1g', priceRands: 150, description: 'Sativa flower — 1g.' },
      { name: 'Top Cherry 5g', priceRands: 600, description: 'Sativa flower — 5g.' },
      { name: 'Animal Tsunami 1g', priceRands: 150, description: 'Sativa flower — 1g.' },
      { name: 'Animal Tsunami 5g', priceRands: 600, description: 'Sativa flower — 5g.' },
      { name: 'Cotton Candy Lobster 1g', priceRands: 150, description: 'Sativa flower — 1g.' },
      { name: 'Cotton Candy Lobster 5g', priceRands: 600, description: 'Sativa flower — 5g.' },
    ],
  },
  {
    category: 'Hybrids',
    slug: 'hybrids',
    items: [
      { name: 'Superboof 1g', priceRands: 150, description: 'Hybrid flower — 1g.' },
      { name: 'Superboof 5g', priceRands: 600, description: 'Hybrid flower — 5g.' },
      { name: 'Unicorn Poop 1g', priceRands: 150, description: 'Hybrid flower — 1g.' },
      { name: 'Unicorn Poop 5g', priceRands: 600, description: 'Hybrid flower — 5g.' },
      { name: 'Tart Pops 1g', priceRands: 150, description: 'Hybrid flower — 1g.' },
      { name: 'Tart Pops 5g', priceRands: 600, description: 'Hybrid flower — 5g.' },
    ],
  },
  {
    category: 'Indicas',
    slug: 'indicas',
    items: [
      { name: 'Sunset Sherbert 1g', priceRands: 150, description: 'Indica flower — 1g.' },
      { name: 'Sunset Sherbert 5g', priceRands: 600, description: 'Indica flower — 5g.' },
      { name: 'Permanent Marker 1g', priceRands: 150, description: 'Indica flower — 1g.' },
      { name: 'Permanent Marker 5g', priceRands: 600, description: 'Indica flower — 5g.' },
      { name: 'Space Bomb 1g', priceRands: 150, description: 'Indica flower — 1g.' },
      { name: 'Space Bomb 5g', priceRands: 600, description: 'Indica flower — 5g.' },
      { name: 'Pink Panties 1g', priceRands: 150, description: 'Indica flower — 1g.' },
      { name: 'Pink Panties 5g', priceRands: 600, description: 'Indica flower — 5g.' },
      { name: 'Jedi Code 1g', priceRands: 150, description: 'Indica flower — 1g.' },
      { name: 'Jedi Code 5g', priceRands: 600, description: 'Indica flower — 5g.' },
    ],
  },
  {
    category: 'Cannabis Caps',
    slug: 'cannabis-caps',
    items: [
      { name: 'Hybrid Cap 50mg (1)', priceRands: 50, description: '50mg cannabis per cap — Hybrid. Single.' },
      { name: 'Hybrid Caps 50mg (6)', priceRands: 250, description: '50mg cannabis per cap — Hybrid. Pack of 6.' },
      { name: 'Sativa Cap 50mg (1)', priceRands: 50, description: '50mg cannabis per cap — Sativa. Single.' },
      { name: 'Sativa Caps 50mg (6)', priceRands: 250, description: '50mg cannabis per cap — Sativa. Pack of 6.' },
      { name: 'Indica Cap 50mg (1)', priceRands: 50, description: '50mg cannabis per cap — Indica. Single.' },
      { name: 'Indica Caps 50mg (6)', priceRands: 250, description: '50mg cannabis per cap — Indica. Pack of 6.' },
    ],
  },
  {
    category: 'Hash',
    slug: 'hash',
    items: [
      { name: 'Moroccan Chocolate Hashish 1g', priceRands: 120, description: 'Classic Moroccan chocolate hashish — 1g.' },
      { name: 'Fruit Sorbet Ice Water Bubble Hash 1g', priceRands: 160, description: 'Fruit Sorbet ice water bubble hash — 1g.' },
    ],
  },
  {
    category: 'Live Rosin Dab',
    slug: 'live-rosin',
    items: [
      { name: 'Live Rosin Dab RS11 1g', priceRands: 650, description: 'Live rosin dab — RS11, 1g.' },
      { name: 'Live Rosin Dab Guelah Papaya 1g', priceRands: 650, description: 'Live rosin dab — Guelah Papaya, 1g.' },
      { name: 'Live Rosin Dab Blue Zushie 1g', priceRands: 650, description: 'Live rosin dab — Blue Zushie, 1g.' },
    ],
  },
  {
    category: 'Diamonds',
    slug: 'diamonds',
    items: [
      { name: 'Diamonds Pineapple Sundae 1g', priceRands: 350, description: 'THC diamonds — Pineapple Sundae, 1g.' },
      { name: 'Diamonds Strawberry Banana 1g', priceRands: 350, description: 'THC diamonds — Strawberry Banana, 1g.' },
    ],
  },
  {
    category: 'Badders',
    slug: 'badders',
    items: [
      { name: 'Badder Banana Hammock 1g', priceRands: 220, description: 'Cannabis badder — 1g.' },
      { name: 'Badder Cereal Milk 1g', priceRands: 220, description: 'Cannabis badder — 1g.' },
      { name: 'Badder Cindy 99 1g', priceRands: 220, description: 'Cannabis badder — 1g.' },
      { name: 'Badder Gush Mintz 1g', priceRands: 220, description: 'Cannabis badder — 1g.' },
      { name: 'Badder Kosher Kush 1g', priceRands: 220, description: 'Cannabis badder — 1g.' },
      { name: 'Badder Passion Fruit 1g', priceRands: 220, description: 'Cannabis badder — 1g.' },
      { name: 'Badder Purple OG 1g', priceRands: 220, description: 'Cannabis badder — 1g.' },
      { name: 'Badder Sour OG 1g', priceRands: 220, description: 'Cannabis badder — 1g.' },
      { name: 'Badder Strawberry Pop 1g', priceRands: 220, description: 'Cannabis badder — 1g.' },
    ],
  },
  {
    category: 'Crumble',
    slug: 'crumble',
    items: [
      { name: 'Crumble Royal Runtz 1g', priceRands: 250, description: 'Crumble — Royal Runtz (Sativa), 1g.' },
    ],
  },
  {
    category: 'Honeycomb',
    slug: 'honeycomb',
    items: [
      { name: 'Honeycomb Bubba Kush 1g', priceRands: 250, description: 'Honeycomb — Bubba Kush (Hybrid), 1g.' },
      { name: 'Honeycomb MAC 33 1g', priceRands: 250, description: 'Honeycomb — MAC 33 (Hybrid), 1g.' },
      { name: 'Honeycomb Orange Zlushie 1g', priceRands: 250, description: 'Honeycomb — Orange Zlushie (Hybrid), 1g.' },
      { name: 'Honeycomb Pink Lemonade 1g', priceRands: 250, description: 'Honeycomb — Pink Lemonade (Hybrid), 1g.' },
    ],
  },
  {
    category: 'Disposable Vape',
    slug: 'disposable-vape',
    items: [
      { name: 'Disposable Vape Mowi Wowi 1ml', priceRands: 500, description: 'Disposable vape — Mowi Wowi, 1ml.' },
      { name: 'Disposable Vape Toffee Diesel 1ml', priceRands: 500, description: 'Disposable vape — Toffee Diesel, 1ml.' },
      { name: 'Disposable Vape Ace of Spades 1ml', priceRands: 500, description: 'Disposable vape — Ace of Spades, 1ml.' },
      { name: 'Disposable Vape Apple Jar 1ml', priceRands: 500, description: 'Disposable vape — Apple Jar, 1ml.' },
      { name: 'Disposable Vape Cherry Ade 1ml', priceRands: 500, description: 'Disposable vape — Cherry Ade, 1ml.' },
    ],
  },
  {
    category: 'Live Resin Carts',
    slug: 'live-resin-carts',
    items: [
      { name: 'Live Resin Cart Jack Herer 1ml', priceRands: 800, description: 'Live resin cart — Jack Herer, 1ml.' },
      { name: 'Live Resin Cart Horchata 1ml', priceRands: 800, description: 'Live resin cart — Horchata, 1ml.' },
      { name: 'Live Resin Cart OG Paradise 1ml', priceRands: 800, description: 'Live resin cart — OG Paradise, 1ml.' },
      { name: 'Live Resin Cart Mai Tai Amnesia 1ml', priceRands: 800, description: 'Live resin cart — Mai Tai Amnesia, 1ml.' },
      { name: 'Live Resin Cart Cereal Milk 1ml', priceRands: 800, description: 'Live resin cart — Cereal Milk, 1ml.' },
      { name: 'Live Resin Cart London Pound Cake 1ml', priceRands: 800, description: 'Live resin cart — London Pound Cake, 1ml.' },
      { name: 'Live Resin Cart Dabbalicious 1ml', priceRands: 800, description: 'Live resin cart — Dabbalicious, 1ml.' },
      { name: 'Live Resin Cart Tangie Dream 1ml', priceRands: 800, description: 'Live resin cart — Tangie Dream, 1ml.' },
      { name: 'Live Resin Cart Lemon Cherry 1ml', priceRands: 800, description: 'Live resin cart — Lemon Cherry, 1ml.' },
      { name: 'Live Resin Cart Caribbean Dream 1ml', priceRands: 800, description: 'Live resin cart — Caribbean Dream, 1ml.' },
    ],
  },
  {
    category: 'Medibles',
    slug: 'medibles',
    items: [
      {
        name: 'Red Vine Strips (Vegan)',
        priceRands: 250,
        description: '20mg/strip · 200mg/pack. Vegan.',
      },
      {
        name: 'Rainbow Stripz',
        priceRands: 250,
        description: '20mg/strip · 200mg/pack.',
      },
      {
        name: 'Chocolate Chip Cookie 50mg',
        priceRands: 50,
        description: '50mg cookie — Indica or Sativa. Tell us which at confirm.',
      },
      {
        name: 'The OG Gummies',
        priceRands: 200,
        description: '22.5mg/cube · 150mg/pack.',
      },
      {
        name: 'Blaze Blocks',
        priceRands: 200,
        description: '15mg/gummy · 150mg/pack.',
      },
    ],
  },
];

async function main() {
  const env = (a: string, b: string) => process.env[a]?.trim() || process.env[b]?.trim() || '';
  const ownerEmail = (env('DR_MARLEY_OWNER_EMAIL', 'BART_OWNER_EMAIL') || 'owner@drmarley.co.za').toLowerCase();
  const ownerPassword = env('DR_MARLEY_OWNER_PASSWORD', 'BART_OWNER_PASSWORD') || 'BartMarley2026!';
  const ownerName = env('DR_MARLEY_OWNER_NAME', 'BART_OWNER_NAME') || 'Dr Marley';
  const bontleSlug = process.env.BONTLE_SLUG ?? 'bontle-entle';
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM?.trim() || null;

  const driverPhones = (env('DR_MARLEY_DRIVER_PHONES', 'BART_DRIVER_PHONES') ?? '')
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const driverNames = (env('DR_MARLEY_DRIVER_NAMES', 'BART_DRIVER_NAMES') ?? '')
    .split(/[,;]/)
    .map((n) => n.trim())
    .filter(Boolean);
  const drivers = driverPhones.map((phone, i) => ({
    name: driverNames[i] || `Driver ${i + 1}`,
    phone,
  }));
  const retailMeta = {
    ...DEFAULT_RETAIL_SETTINGS,
    alwaysOpen: true,
    notifyStaffOnOrder: true,
    driverNotifyEnabled: drivers.length > 0,
    driverPhones,
    drivers,
  };

  const existingDispensary = await prisma.salon.findFirst({
    where: { slug: { in: ['dr-marley', 'bart-marley'] } },
  });

  const salonFields = {
    slug: 'dr-marley',
    name: 'Dr Marley Dispensary',
    tradingName: 'Dr Marley',
    legalName: 'Dr Marley Dispensary (Pty) Ltd',
    industryTemplate: 'dispensary' as const,
    businessType: 'RETAIL' as const,
    status: 'ACTIVE' as const,
    botName: 'Marley',
    welcomeMessage: 'Welcome to Dr Marley Dispensary 🌿 Open 24/7 — reply with a number:',
    botLoyaltyEnabled: false,
    openTime: '00:00',
    closeTime: '23:59',
    metadata: {
      retail: retailMeta,
      currentSpecial: 'Free delivery over R400 this week',
      theme: 'dispensary',
    },
  };

  const bart = existingDispensary
    ? await prisma.salon.update({
        where: { id: existingDispensary.id },
        data: salonFields,
      })
    : await prisma.salon.create({
        data: {
          ...salonFields,
          tier: 'pro',
          timezone: 'Africa/Johannesburg',
          defaultCurrency: 'zar',
          locale: 'en-ZA',
          toneFormality: 35,
          toneWarmth: 75,
          tonePlayfulness: 55,
          tonePace: 40,
          toneSalesEnergy: 45,
          addressLine: 'Johannesburg, South Africa',
          phoneDisplay: '+27 10 000 0001',
          botAllowStaffPick: false,
          botAskMarketingConsent: true,
          botRequirePaymentStep: false,
        },
      });

  // Hours — 24/7 (Uber Eats–style WhatsApp ordering)
  const hourRows = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    openMin: 0,
    closeMin: 24 * 60,
  }));
  for (const h of hourRows) {
    await prisma.businessHour.upsert({
      where: { salonId_dayOfWeek: { salonId: bart.id, dayOfWeek: h.dayOfWeek } },
      create: { salonId: bart.id, ...h },
      update: { openMin: h.openMin, closeMin: h.closeMin },
    });
  }

  // Catalog — deactivate old SKUs, then upsert Dr. Marley price list
  await prisma.service.updateMany({
    where: { salonId: bart.id },
    data: { active: false },
  });

  const keepNames = new Set(CANNABIS_CATALOG.flatMap((c) => c.items.map((i) => i.name)));
  let sort = 0;
  for (const cat of CANNABIS_CATALOG) {
    // findFirst+create/update: production may lack salonId+slug unique (Prisma upsert needs it)
    let category = await prisma.serviceCategory.findFirst({
      where: { salonId: bart.id, slug: cat.slug },
    });
    if (category) {
      category = await prisma.serviceCategory.update({
        where: { id: category.id },
        data: { name: cat.category, sortOrder: sort++ },
      });
    } else {
      category = await prisma.serviceCategory.create({
        data: { salonId: bart.id, name: cat.category, slug: cat.slug, sortOrder: sort++ },
      });
    }
    let itemSort = 0;
    for (const item of cat.items) {
      const existing = await prisma.service.findFirst({
        where: { salonId: bart.id, name: item.name },
      });
      if (existing) {
        await prisma.service.update({
          where: { id: existing.id },
          data: {
            priceCents: item.priceRands * 100,
            description: item.description,
            durationMin: 0,
            active: true,
            categoryId: category.id,
            qualifiesLoyalty: false,
            sortOrder: itemSort++,
            trackInventory: true,
            stockQty: existing.stockQty > 0 ? existing.stockQty : 40,
            lowStockThreshold: 5,
          },
        });
      } else {
        await prisma.service.create({
          data: {
            salonId: bart.id,
            name: item.name,
            description: item.description,
            durationMin: 0,
            bufferMin: 0,
            priceCents: item.priceRands * 100,
            categoryId: category.id,
            qualifiesLoyalty: false,
            sortOrder: itemSort++,
            trackInventory: true,
            stockQty: 40,
            lowStockThreshold: 5,
          },
        });
      }
    }
  }

  // Hide any leftover SKUs not on the current Dr. Marley list
  await prisma.service.updateMany({
    where: { salonId: bart.id, name: { notIn: [...keepNames] } },
    data: { active: false },
  });

  // Hide legacy placeholder categories that are no longer on the menu
  const activeSlugs = CANNABIS_CATALOG.map((c) => c.slug);
  const staleCategories = await prisma.serviceCategory.findMany({
    where: { salonId: bart.id, slug: { notIn: activeSlugs } },
    select: { id: true },
  });
  if (staleCategories.length > 0) {
    await prisma.service.updateMany({
      where: { salonId: bart.id, categoryId: { in: staleCategories.map((c) => c.id) } },
      data: { active: false },
    });
  }

  // Fulfillment “staff” row (orders don’t need stylists, but schema sometimes expects staff)
  let runner = await prisma.staff.findFirst({
    where: { salonId: bart.id, name: 'Delivery Desk' },
  });
  if (!runner) {
    runner = await prisma.staff.create({
      data: {
        salonId: bart.id,
        name: 'Delivery Desk',
        displayName: 'Delivery Desk',
        active: true,
        isBookable: false,
        specialties: ['delivery', 'collection'],
      },
    });
  }

  const passwordHash = await bcrypt.hash(ownerPassword, 12);
  const ownerPhone = env('DR_MARLEY_OWNER_PHONE', 'BART_OWNER_PHONE') || null;
  const legacyOwnerEmail = 'owner@bartmarley.co.za';

  // StaffUser.phone is globally unique — free it from another salon user if needed
  if (ownerPhone) {
    const phoneHolder = await prisma.staffUser.findFirst({
      where: {
        phone: ownerPhone,
        NOT: { email: { in: [ownerEmail, legacyOwnerEmail] } },
      },
      select: { id: true, email: true, salonId: true },
    });
    if (phoneHolder) {
      await prisma.staffUser.update({
        where: { id: phoneHolder.id },
        data: { phone: null },
      });
      console.log(
        `Note: moved phone ${ownerPhone} from ${phoneHolder.email} → Dr Marley owner (StaffUser.phone is unique).`,
      );
    }
  }

  const existingOwner =
    (await prisma.staffUser.findUnique({ where: { email: ownerEmail } })) ??
    (await prisma.staffUser.findUnique({ where: { email: legacyOwnerEmail } }));

  if (existingOwner) {
    await prisma.staffUser.update({
      where: { id: existingOwner.id },
      data: {
        salonId: bart.id,
        email: ownerEmail,
        name: ownerName,
        passwordHash,
        role: 'OWNER',
        active: true,
        ...(ownerPhone ? { phone: ownerPhone } : {}),
      },
    });
  } else {
    await prisma.staffUser.create({
      data: {
        salonId: bart.id,
        email: ownerEmail,
        name: ownerName,
        passwordHash,
        role: 'OWNER',
        active: true,
        ...(ownerPhone ? { phone: ownerPhone } : {}),
      },
    });
  }

  await prisma.faqItem.deleteMany({ where: { salonId: bart.id } });
  await prisma.faqItem.createMany({
    data: [
      {
        salonId: bart.id,
        question: 'Do you deliver?',
        answer: 'Yes — we deliver across Joburg metro. Delivery fee applies under R400; free over R400 this week.',
        sortOrder: 1,
      },
      {
        salonId: bart.id,
        question: 'What is the minimum order?',
        answer: 'Minimum order is R150 before delivery fee.',
        sortOrder: 2,
      },
      {
        salonId: bart.id,
        question: 'Are your products lab-tested?',
        answer: 'Yes. Flower and edibles are lab-tested. Ask in chat for the current batch COA.',
        sortOrder: 3,
      },
      {
        salonId: bart.id,
        question: 'What strains / menu do you have?',
        answer:
          'Full Dr. Marley menu: Greenhouse & Premium Greenhouse, Prerolls, Indoor Special, Sativas/Hybrids/Indicas, Caps, Hash, Live Rosin, Diamonds, Badders, Crumble, Honeycomb, Disposable Vapes, Live Resin Carts, and Medibles. Reply *1* to order.',
        sortOrder: 6,
      },
    ],
  });

  // Link Bontle if present
  let bontle = await prisma.salon.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { slug: bontleSlug },
        { tradingName: { contains: 'Bontle', mode: 'insensitive' } },
        { name: { contains: 'Bontle', mode: 'insensitive' } },
      ],
    },
  });

  // Fallback: any non-router, non-bart salon that currently owns the WhatsApp number
  if (!bontle && twilioFrom) {
    bontle = await prisma.salon.findFirst({
      where: {
        deletedAt: null,
        twilioWhatsAppNumber: twilioFrom,
        slug: { notIn: ['bart-marley', 'dr-marley'] },
        isBusinessRouter: false,
      },
    });
  }

  const linkedBusinesses = [
    ...(bontle
      ? [
          {
            salonId: bontle.id,
            label: 'BontleEntle',
            subtitle: 'Hair & beauty salon',
            industryTemplate: bontle.industryTemplate || 'salon',
          },
        ]
      : []),
    {
      salonId: bart.id,
      label: 'Dr Marley',
      subtitle: 'Cannabis & wellness · delivery',
      industryTemplate: 'dispensary',
    },
  ];

  // Move WhatsApp number onto router (unique constraint)
  let numberForRouter = twilioFrom;
  if (bontle?.twilioWhatsAppNumber) {
    numberForRouter = bontle.twilioWhatsAppNumber;
    await prisma.salon.update({
      where: { id: bontle.id },
      data: { twilioWhatsAppNumber: null },
    });
  }
  // Ensure Bart doesn't keep a competing number
  await prisma.salon.update({
    where: { id: bart.id },
    data: { twilioWhatsAppNumber: null, whatsappPhoneId: null },
  });

  const routerMetaPhone = bontle?.whatsappPhoneId ?? null;
  if (bontle?.whatsappPhoneId) {
    await prisma.salon.update({
      where: { id: bontle.id },
      data: { whatsappPhoneId: null },
    });
  }

  const router = await prisma.salon.upsert({
    where: { slug: 'whatsapp-router' },
    create: {
      slug: 'whatsapp-router',
      name: 'WhatsApp Business Hub',
      tradingName: 'Business Hub',
      industryTemplate: 'salon',
      businessType: 'OTHER',
      status: 'ACTIVE',
      isBusinessRouter: true,
      timezone: 'Africa/Johannesburg',
      defaultCurrency: 'zar',
      locale: 'en-ZA',
      botName: 'Host',
      twilioWhatsAppNumber: numberForRouter,
      whatsappPhoneId: routerMetaPhone,
      metadata: {
        isBusinessRouter: true,
        linkedBusinesses,
      },
    },
    update: {
      isBusinessRouter: true,
      status: 'ACTIVE',
      twilioWhatsAppNumber: numberForRouter,
      whatsappPhoneId: routerMetaPhone,
      metadata: {
        isBusinessRouter: true,
        linkedBusinesses,
      },
    },
  });

  console.log('── Dr Marley Dispensary ready ──');
  console.log(`Salon id:     ${bart.id}`);
  console.log(`Dashboard:    login with email ${ownerEmail}`);
  console.log(`Password:     ${ownerPassword}`);
  console.log(`Owner phone:  ${ownerPhone ?? '(set DR_MARLEY_OWNER_PHONE for WhatsApp order alerts)'}`);
  console.log(
    `Drivers:      ${
      drivers.length
        ? drivers.map((d) => `${d.name}<${d.phone}>`).join(', ')
        : '(set DR_MARLEY_DRIVER_PHONES for Uber-style ACCEPT/DECLINE on shared number)'
    }`,
  );
  console.log(`Router id:    ${router.id}`);
  console.log(`WhatsApp on:  ${numberForRouter ?? '(set TWILIO_WHATSAPP_FROM / move from Bontle)'}`);
  console.log(`Linked:       ${linkedBusinesses.map((b) => b.label).join(' | ')}`);
  console.log(`Menu SKUs:    ${CANNABIS_CATALOG.reduce((n, c) => n + c.items.length, 0)} products / ${CANNABIS_CATALOG.length} categories`);
  if (!bontle) {
    console.log('Note: Bontle salon not found — router only lists Dr Marley. Set BONTLE_SLUG and re-run.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

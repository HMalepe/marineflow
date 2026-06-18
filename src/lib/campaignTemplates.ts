export type CampaignTemplateCategory =
  | 'seasonal'
  | 'holiday'
  | 'promo'
  | 'win-back'
  | 'loyalty'
  | 'new-client'
  | 'services'
  | 'flash'
  | 'thank-you';

export interface CampaignTemplate {
  id: string;
  name: string;
  category: CampaignTemplateCategory;
  description: string;
  message: string;
  suggestedMonth?: number;
  tags?: string[];
}

export const CAMPAIGN_TEMPLATE_CATEGORIES: {
  id: CampaignTemplateCategory | 'all';
  label: string;
}[] = [
  { id: 'all', label: 'All' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'holiday', label: 'Holidays & events' },
  { id: 'promo', label: 'Promotions' },
  { id: 'win-back', label: 'Win-back' },
  { id: 'loyalty', label: 'Loyalty & rewards' },
  { id: 'new-client', label: 'New clients' },
  { id: 'services', label: 'By service' },
  { id: 'flash', label: 'Flash & last-minute' },
  { id: 'thank-you', label: 'Thank you & referrals' },
];

const BOOK_CTA = '\n\nReply 1 to book or ask us anything.\n\nReply STOP to opt out.';

function tpl(
  id: string,
  name: string,
  category: CampaignTemplateCategory,
  description: string,
  body: string,
  extra?: Pick<CampaignTemplate, 'suggestedMonth' | 'tags'>,
): CampaignTemplate {
  return {
    id,
    name,
    category,
    description,
    message: body.trim() + BOOK_CTA,
    ...extra,
  };
}

function comboTemplates(
  category: CampaignTemplateCategory,
  prefix: string,
  hooks: string[],
  offers: string[],
  namePrefix: string,
): CampaignTemplate[] {
  const out: CampaignTemplate[] = [];
  hooks.forEach((hook, hi) => {
    offers.forEach((offer, oi) => {
      const id = `${prefix}-${hi}-${oi}`;
      out.push(
        tpl(
          id,
          `${namePrefix} — ${offer.split('—')[0]?.trim().slice(0, 36) || `Option ${hi * offers.length + oi + 1}`}`,
          category,
          `${hook.replace(/\n/g, ' ').slice(0, 80)}…`,
          `${hook}\n\n${offer}`,
        ),
      );
    });
  });
  return out;
}

const HANDCRAFTED: CampaignTemplate[] = [
  tpl(
    'winter-special',
    'Winter Warm-Up Special',
    'seasonal',
    'Combat dry winter hair with a nourishing treatment offer.',
    'Winter is here ❄️\n\nCold air can leave hair dry and brittle. Treat yourself to our Deep Conditioning + Blow Dry combo — now R120 off this month.',
    { suggestedMonth: 6 },
  ),
  tpl(
    'mothers-day',
    "Mother's Day Pamper",
    'holiday',
    'Gift mom a well-deserved pamper session.',
    "Mother's Day is around the corner 💐\n\nSpoil Mom with a cut, colour, or full pamper package. Book before slots fill up — mention MOM25 for 25% off her visit.",
    { suggestedMonth: 5 },
  ),
  tpl(
    'valentines-day',
    "Valentine's Date-Ready",
    'holiday',
    'Look your best for date night.',
    "Valentine's is coming 💕\n\nFresh cut, blow dry, or a quick beard trim — look sharp for date night. Couples who book together get 15% off combined services.",
    { suggestedMonth: 2 },
  ),
  tpl(
    'heritage-day',
    'Heritage Day Celebration',
    'holiday',
    'Celebrate South African heritage with a community offer.',
    'Happy Heritage Month 🇿🇦\n\nCelebrate who we are with a fresh look. This week only — 20% off all cuts and styling for our loyal clients.',
    { suggestedMonth: 9, tags: ['public-holiday', 'sa'] },
  ),
  tpl(
    'december-holidays',
    'December Holiday Hair',
    'seasonal',
    'Festive season booking push before slots fill up.',
    'Festive season is here ✨\n\nParties, holidays, family photos — book your December appointment before slots disappear. Early birds get a free hot towel treatment.',
    { suggestedMonth: 12 },
  ),
  tpl(
    'new-year-reset',
    'New Year, New Look',
    'seasonal',
    'January fresh-start campaign.',
    'New year, new you 🎉\n\nStart the year with a confidence boost. Book any colour or cut in January and receive a complimentary scalp massage.',
    { suggestedMonth: 1 },
  ),
  tpl(
    'spring-special',
    'Spring Colour Refresh',
    'seasonal',
    'Spring colour and highlights push.',
    'Spring is in the air 🌸\n\nRefresh your colour or add subtle highlights for the new season. Book this month and save R150 on colour services.',
    { suggestedMonth: 9 },
  ),
  tpl(
    'midweek-fill',
    'Midweek Quiet Day Special',
    'promo',
    'Fill quiet Tuesday/Wednesday slots.',
    'Midweek magic ✂️\n\nTuesdays and Wednesdays are our quietest days — enjoy 15% off any service when you book midweek.',
  ),
];

const WIN_BACK = comboTemplates(
  'win-back',
  'winback',
  [
    'We miss you 💚',
    "It's been a while — we'd love to see you again ✨",
    'Your chair is waiting 🪑',
    'Time for a refresh? 💇',
    'We noticed you haven\'t visited lately 👋',
    'Come back and feel like yourself again 💆',
    'Your favourite stylist asked about you 💬',
    'Life gets busy — we saved a spot for you 📅',
    'Ready for a pick-me-up? ☕',
    'Treat yourself — you deserve it 💅',
  ],
  [
    'Come back this month for a complimentary treatment add-on.',
    'Enjoy 15% off your next visit when you book this week.',
    'Book within 7 days and get R100 off any service.',
    'Return visit special: free deep conditioning with any cut.',
    'We\'re offering loyal clients 20% off colour services this month.',
    'Mention COMEBACK for a free blow dry with your next appointment.',
    'Book a pamper package and receive a complimentary hand treatment.',
    'First appointment back? Enjoy 10% off — our way of saying welcome back.',
  ],
  'Win-back',
);

const PROMOS = comboTemplates(
  'promo',
  'promo',
  [
    'Exclusive offer just for you 🎁',
    'This week only — don\'t miss out ⏰',
    'Member appreciation sale 💝',
    'Flash deal alert 🔥',
    'Your VIP offer is inside ✨',
    'Limited slots at a special price 📍',
    'Salon favourite — now on special ⭐',
    'Treat yourself for less 💰',
  ],
  [
    '15% off all cuts and styling when you book this week.',
    '20% off colour services — mention PROMO15 at booking.',
    'Buy any cut, get a complimentary wash & blow dry.',
    'R150 off full highlights — valid until Sunday.',
    'Couples package: book together and save 25%.',
    'Student special: show your card for R50 off any service.',
    'Free eyebrow shape with any facial this month.',
    'Pamper trio: cut, treatment & style — one bundle price.',
  ],
  'Promotion',
);

const LOYALTY = comboTemplates(
  'loyalty',
  'loyalty',
  [
    'Thank you for being a loyal client 🙏',
    'You\'ve earned a reward ⭐',
    'Loyalty milestone unlocked 🏆',
    'Because you keep coming back 💚',
    'VIP client appreciation 💎',
    'Your loyalty points are waiting 🎟️',
  ],
  [
    'Enjoy a complimentary upgrade on your next visit — treatment of your choice.',
    'Redeem your loyalty reward: 20% off any service this month.',
    'Book your 5th visit perk: free scalp massage with any appointment.',
    'Refer a friend and both get R100 off your next booking.',
    'Birthday month? Claim your free add-on service on us.',
    'Double loyalty points on all bookings this week.',
  ],
  'Loyalty',
);

const NEW_CLIENT = comboTemplates(
  'new-client',
  'newclient',
  [
    'Welcome to our salon family 👋',
    'First time with us? Here\'s a gift 🎁',
    'New client exclusive ✨',
    'We\'d love to meet you 💇',
    'Your first visit should feel special 🌟',
  ],
  [
    'Enjoy 20% off your first cut or colour — mention WELCOME when you book.',
    'First visit: complimentary consultation + R80 off any service.',
    'New clients get a free treatment add-on with their first appointment.',
    'Book your first visit this week and receive a take-home care sample.',
    'Intro offer: cut + blow dry at a special first-timer price.',
    'Try us once — we\'ll make it worth your while with 15% off everything.',
  ],
  'New client',
);

const SERVICE_LINES = [
  { tag: 'hair', label: 'Hair', emoji: '💇', hooks: ['Fresh cut season', 'Colour refresh time', 'Healthy hair starts here'] },
  { tag: 'nails', label: 'Nails', emoji: '💅', hooks: ['Perfect nails await', 'Mani-pedi season', 'Nail art special'] },
  { tag: 'beauty', label: 'Beauty & skin', emoji: '✨', hooks: ['Glow-up season', 'Skin care moment', 'Self-care Sunday'] },
  { tag: 'grooming', label: 'Grooming', emoji: '✂️', hooks: ['Sharp look, clean finish', 'Beard & grooming day', 'Gentlemen\'s special'] },
  { tag: 'massage', label: 'Massage & wellness', emoji: '💆', hooks: ['Unwind with us', 'Stress relief special', 'Body wellness hour'] },
  { tag: 'lashes', label: 'Lashes & brows', emoji: '👁️', hooks: ['Frame your eyes', 'Lash lift season', 'Brow perfection'] },
];

function serviceTemplates(): CampaignTemplate[] {
  const out: CampaignTemplate[] = [];
  const offers = [
    'Book this week and save 10% on your next {service} appointment.',
    'Limited slots — complimentary consultation with any {service} booking.',
    '{service} special: mention SALON10 for a treat on us.',
    'Bundle & save: combine two {service} services and get 15% off.',
    'Walk-in welcome hours — best availability Tue–Thu mornings.',
  ];
  SERVICE_LINES.forEach((line) => {
    line.hooks.forEach((hook, hi) => {
      offers.forEach((offerTpl, oi) => {
        const service = line.label.toLowerCase();
        const offer = offerTpl.replace(/\{service\}/g, service);
        out.push(
          tpl(
            `svc-${line.tag}-${hi}-${oi}`,
            `${line.label} — ${hook}`,
            'services',
            `${line.label} campaign for booked appointments.`,
            `${line.emoji} ${hook}\n\n${offer.charAt(0).toUpperCase() + offer.slice(1)}`,
            { tags: [line.tag] },
          ),
        );
      });
    });
  });
  return out;
}

const FLASH = comboTemplates(
  'flash',
  'flash',
  [
    'Last-minute openings today ⚡',
    'Slow day special — walk in now 🚶',
    'Flash sale — ends tonight 🌙',
    'We have 3 slots left today 📅',
    'Same-day booking bonus 🎯',
    'Quiet afternoon — grab a deal ☀️',
  ],
  [
    'Reply BOOK now — 20% off any service booked for today.',
    'Walk in before 4pm and enjoy R80 off your service.',
    'Today only: complimentary treatment with any booking.',
    'First 5 replies get priority booking + 15% off.',
    'Same-day colour or cut — special rate until close.',
  ],
  'Flash',
);

const THANK_YOU = comboTemplates(
  'thank-you',
  'thanks',
  [
    'Thank you for visiting us yesterday 🙏',
    'We hope you loved your visit ✨',
    'Thanks for trusting us with your look 💚',
    'You made our day — thank you 😊',
    'Grateful for clients like you 💝',
  ],
  [
    'Book your next appointment within 14 days and get 10% off.',
    'Leave us a Google review and mention REVIEW for a free add-on next visit.',
    'Refer a friend — you both receive R100 off.',
    'Your feedback means everything. Reply with how we did!',
    'Ready for your next visit? Reply 1 and we\'ll hold a slot.',
  ],
  'Thank you',
);

const HOLIDAY_EXTRA: CampaignTemplate[] = [
  ['easter-fresh', 'Easter Fresh Look', 3, 'Long weekend ahead 🐣\n\nStep into Easter with a fresh new look. Book your cut or colour this week and get a complimentary hair wash.'],
  ['youth-day', 'Youth Day Fresh Cuts', 6, 'Youth Day special 🎓\n\nStudents and under-25s get R50 off any cut this week. Show your student card in salon.'],
  ['fathers-day', "Father's Day Grooming", 6, "Father's Day grooming package 👔\n\nTreat Dad to a cut, beard trim, and hot towel — all for one special price. Gift vouchers available."],
  ['womens-day', "Women's Day Empowerment", 3, "Happy Women's Month 💪\n\nCelebrate the women in your life — or treat yourself. Book any pamper package this week and receive 20% off."],
  ['human-rights', 'Human Rights Day', 3, 'Long weekend treat 🇿🇦\n\nBook any service before the public holiday and enjoy a complimentary hot towel finish.'],
  ['freedom-day', 'Freedom Day Glow', 4, 'Freedom Day long weekend ✨\n\nCelebrate with a fresh look — 15% off all styling services this week.'],
  ['workers-day', "Worker's Day Relax", 5, 'You work hard — time to unwind 💆\n\nBook any massage or pamper package and get 20% off this week.'],
  ['youth-day-sa', 'Youth Day SA', 6, 'Youth Day vibes 🎉\n\nUnder-30s enjoy special pricing on cuts and colour — book now.'],
  ['heritage-long', 'Heritage Long Weekend', 9, 'Heritage long weekend 🇿🇦\n\nFamily photos? Parties? Book your festive-ready look now.'],
  ['christmas-eve', 'Christmas Eve Slots', 12, 'Christmas Eve appointments 🎄\n\nLast-minute gift? Salon vouchers available — or book yourself in before the rush.'],
  ['black-friday', 'Black Friday Salon Sale', 11, 'Black Friday is here 🛍️\n\nOur biggest offer of the year — 30% off selected services for 48 hours only.'],
  ['cyber-monday', 'Cyber Monday Bookings', 11, 'Cyber Monday 💻\n\nBook online today only — extra 10% off when you schedule through WhatsApp.'],
].map(([id, name, month, body]) =>
  tpl(id as string, name as string, 'holiday', `${name} campaign.`, body as string, {
    suggestedMonth: month as number,
    tags: ['public-holiday', 'sa'],
  }),
);

const SEASONAL_EXTRA = comboTemplates(
  'seasonal',
  'season',
  [
    'Summer sun protection ☀️',
    'Autumn tone refresh 🍂',
    'Winter hydration boost ❄️',
    'Spring awakening 🌸',
    'Rainy season hair care 🌧️',
    'Holiday party season 🥂',
    'Back-to-school fresh start 📚',
    'End-of-year thank you 🎊',
  ],
  [
    'Seasonal treatment package — book now and save 15%.',
    'Protect and nourish — complimentary mask with any colour service.',
    'Beat the weather — hydration treatment special this month.',
    'Seasonal colour trends consultation — free with any booking.',
    'Limited seasonal slots — book early for best times.',
  ],
  'Seasonal',
);

function buildCampaignTemplates(): CampaignTemplate[] {
  const byId = new Map<string, CampaignTemplate>();
  for (const t of [
    ...HANDCRAFTED,
    ...WIN_BACK,
    ...PROMOS,
    ...LOYALTY,
    ...NEW_CLIENT,
    ...serviceTemplates(),
    ...FLASH,
    ...THANK_YOU,
    ...HOLIDAY_EXTRA,
    ...SEASONAL_EXTRA,
  ]) {
    if (!byId.has(t.id)) byId.set(t.id, t);
  }
  return Array.from(byId.values());
}

/** Full template library for WhatsApp newsletters (100+). */
export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = buildCampaignTemplates();

/** @deprecated Use CAMPAIGN_TEMPLATES */
export const SEASONAL_CAMPAIGN_TEMPLATES = CAMPAIGN_TEMPLATES;

export type SeasonalCampaignTemplate = CampaignTemplate;

export function getCampaignTemplate(id: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find((t) => t.id === id);
}

export function filterCampaignTemplates(opts: {
  category?: CampaignTemplateCategory | 'all';
  query?: string;
}): CampaignTemplate[] {
  const q = opts.query?.trim().toLowerCase();
  return CAMPAIGN_TEMPLATES.filter((t) => {
    if (opts.category && opts.category !== 'all' && t.category !== opts.category) return false;
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.message.toLowerCase().includes(q) ||
      t.tags?.some((tag) => tag.toLowerCase().includes(q))
    );
  });
}

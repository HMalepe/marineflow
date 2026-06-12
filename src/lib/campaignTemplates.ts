export interface SeasonalCampaignTemplate {
  id: string;
  name: string;
  category: 'seasonal' | 'holiday' | 'promo';
  description: string;
  message: string;
  suggestedMonth?: number;
  tags?: string[];
}

/** Pre-built newsletter templates — owners pick, tweak, and schedule. */
export const SEASONAL_CAMPAIGN_TEMPLATES: SeasonalCampaignTemplate[] = [
  {
    id: 'winter-special',
    name: 'Winter Warm-Up Special',
    category: 'seasonal',
    description: 'Combat dry winter hair with a nourishing treatment offer.',
    suggestedMonth: 6,
    message:
      'Winter is here ❄️\n\nCold air can leave hair dry and brittle. Treat yourself to our Deep Conditioning + Blow Dry combo — now R120 off this month.\n\nReply 1 to book or ask us anything.\n\nReply STOP to opt out.',
  },
  {
    id: 'mothers-day',
    name: "Mother's Day Pamper",
    category: 'holiday',
    description: 'Gift mom a well-deserved pamper session.',
    suggestedMonth: 5,
    message:
      "Mother's Day is around the corner 💐\n\nSpoil Mom with a cut, colour, or full pamper package. Book before slots fill up — mention MOM25 for 25% off her visit.\n\nReply 1 to book.\n\nReply STOP to opt out.",
  },
  {
    id: 'valentines-day',
    name: "Valentine's Date-Ready",
    category: 'holiday',
    description: 'Look your best for date night.',
    suggestedMonth: 2,
    message:
      "Valentine's is coming 💕\n\nFresh cut, blow dry, or a quick beard trim — look sharp for date night. Couples who book together get 15% off combined services.\n\nReply 1 to book.\n\nReply STOP to opt out.",
  },
  {
    id: 'easter-fresh',
    name: 'Easter Fresh Look',
    category: 'holiday',
    description: 'Spring into the long weekend with a fresh style.',
    suggestedMonth: 3,
    message:
      'Long weekend ahead 🐣\n\nStep into Easter with a fresh new look. Book your cut or colour this week and get a complimentary hair wash.\n\nReply 1 to book.\n\nReply STOP to opt out.',
  },
  {
    id: 'heritage-day',
    name: 'Heritage Day Celebration',
    category: 'holiday',
    description: 'Celebrate South African heritage with a community offer.',
    suggestedMonth: 9,
    tags: ['public-holiday', 'sa'],
    message:
      'Happy Heritage Month 🇿🇦\n\nCelebrate who we are with a fresh look. This week only — 20% off all cuts and styling for our loyal clients.\n\nReply 1 to book.\n\nReply STOP to opt out.',
  },
  {
    id: 'youth-day',
    name: 'Youth Day Fresh Cuts',
    category: 'holiday',
    description: 'Youth Day promotion for students and young professionals.',
    suggestedMonth: 6,
    tags: ['public-holiday', 'sa'],
    message:
      'Youth Day special 🎓\n\nStudents and under-25s get R50 off any cut this week. Show your student card in salon.\n\nReply 1 to book.\n\nReply STOP to opt out.',
  },
  {
    id: 'december-holidays',
    name: 'December Holiday Hair',
    category: 'seasonal',
    description: 'Festive season booking push before slots fill up.',
    suggestedMonth: 12,
    message:
      'Festive season is here ✨\n\nParties, holidays, family photos — book your December appointment before slots disappear. Early birds get a free hot towel treatment.\n\nReply 1 to book.\n\nReply STOP to opt out.',
  },
  {
    id: 'new-year-reset',
    name: 'New Year, New Look',
    category: 'seasonal',
    description: 'January fresh-start campaign.',
    suggestedMonth: 1,
    message:
      'New year, new you 🎉\n\nStart 2027 with a confidence boost. Book any colour or cut in January and receive a complimentary scalp massage.\n\nReply 1 to book.\n\nReply STOP to opt out.',
  },
  {
    id: 'spring-special',
    name: 'Spring Colour Refresh',
    category: 'seasonal',
    description: 'September spring colour and highlights push.',
    suggestedMonth: 9,
    message:
      'Spring is in the air 🌸\n\nRefresh your colour or add subtle highlights for the new season. Book this month and save R150 on colour services.\n\nReply 1 to book.\n\nReply STOP to opt out.',
  },
  {
    id: 'fathers-day',
    name: "Father's Day Grooming",
    category: 'holiday',
    description: 'Father\'s Day grooming package.',
    suggestedMonth: 6,
    message:
      "Father's Day grooming package 👔\n\nTreat Dad to a cut, beard trim, and hot towel — all for one special price. Gift vouchers available.\n\nReply 1 to book.\n\nReply STOP to opt out.",
  },
  {
    id: 'womens-day',
    name: "Women's Day Empowerment",
    category: 'holiday',
    description: "International Women's Day celebration offer.",
    suggestedMonth: 3,
    tags: ['public-holiday', 'sa'],
    message:
      "Happy Women's Month 💪\n\nCelebrate the women in your life — or treat yourself. Book any pamper package this week and receive 20% off.\n\nReply 1 to book.\n\nReply STOP to opt out.",
  },
  {
    id: 'midweek-fill',
    name: 'Midweek Quiet Day Special',
    category: 'promo',
    description: 'Fill quiet Tuesday/Wednesday slots.',
    message:
      'Midweek magic ✂️\n\nTuesdays and Wednesdays are our quietest days — enjoy 15% off any service when you book midweek.\n\nReply 1 to book.\n\nReply STOP to opt out.',
  },
];

export function getCampaignTemplate(id: string): SeasonalCampaignTemplate | undefined {
  return SEASONAL_CAMPAIGN_TEMPLATES.find((t) => t.id === id);
}

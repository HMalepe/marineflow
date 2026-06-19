/** Default aftercare copy by service keyword — used when a service has no custom aftercareNote. */
const DEFAULT_AFTERCARE_TEMPLATES: Array<{ keywords: string[]; note: string }> = [
  {
    keywords: ['lash', 'lashes', 'brow lamination', 'brow lift'],
    note:
      'Avoid water, steam and oil-based products on your lashes for the next 24–48 hours, and skip mascara for today. Sleep on your back if you can, and brush them gently each morning.',
  },
  {
    keywords: ['nail', 'manicure', 'pedicure', 'gel', 'acrylic'],
    note:
      'Give your nails at least an hour before doing anything hands-on, and avoid hot water or harsh chemicals for the first 24 hours. Apply cuticle oil daily to keep them looking fresh.',
  },
  {
    keywords: ['hair', 'colour', 'color', 'dye', 'bleach', 'relax'],
    note:
      'Avoid washing your hair for at least 24–48 hours so the colour/treatment can set, and use a sulphate-free shampoo afterwards to keep it vibrant for longer.',
  },
  {
    keywords: ['cut', 'fade', 'barber', 'shave', 'beard', 'trim'],
    note:
      'Avoid touching the cut area with unwashed hands for the rest of the day, and moisturise if your skin feels dry after the shave/trim. See you again in a few weeks!',
  },
  {
    keywords: ['wax', 'sugaring'],
    note:
      'Avoid hot showers, saunas, swimming and tight clothing over the waxed area for 24 hours, and apply a gentle moisturiser the next day to prevent ingrown hairs.',
  },
  {
    keywords: ['facial', 'skin', 'peel', 'microneedling', 'dermaplan'],
    note:
      'Avoid direct sun, makeup and exfoliating products for the next 24 hours, and apply SPF daily — your skin will be more sensitive than usual.',
  },
  {
    keywords: ['massage', 'spa', 'body treatment'],
    note:
      'Drink plenty of water over the next day to help flush out toxins released during your massage, and avoid strenuous activity this evening.',
  },
  {
    keywords: ['table', 'dinner', 'lunch', 'reservation', 'dining'],
    note:
      'Thanks for dining with us! If you enjoyed your meal, we\'d love a quick review — and don\'t forget to ask about our specials next time you book.',
  },
];

/** Resolves the aftercare message to send ~10 minutes after an appointment completes. */
export function resolveAftercareNote(input: {
  serviceName: string;
  customAftercareNote?: string | null;
}): string | null {
  const custom = input.customAftercareNote?.trim();
  if (custom) return custom;

  const haystack = input.serviceName.toLowerCase();
  for (const template of DEFAULT_AFTERCARE_TEMPLATES) {
    if (template.keywords.some((kw) => haystack.includes(kw))) {
      return template.note;
    }
  }
  return null;
}

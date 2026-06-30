export type PricingCategory = {
  id: string;
  label: string;
  summary: string;
  solutions: readonly string[];
  setupEstimate: string;
  monthlyEstimate: string;
  yearOneGuide: string;
  monthlyNote: string;
};

/** Indicative ranges by sector — every brief is scoped individually. */
export const PRICING_CATEGORIES: readonly PricingCategory[] = [
  {
    id: "salons",
    label: "Salons & barbers",
    summary:
      "Booking-heavy teams juggling WhatsApp enquiries, walk-ins and stylist schedules.",
    solutions: [
      "WhatsApp booking and menu flows",
      "Owner dashboard for appointments and clients",
      "Automated reminders and follow-ups",
      "Optional loyalty or rebooking nudges",
    ],
    setupEstimate: "R7,500 – R18,000",
    monthlyEstimate: "R350 – R950",
    yearOneGuide: "R11,700 – R29,400",
    monthlyNote: "Hosting, messaging usage, light support and small tweaks.",
  },
  {
    id: "clinics",
    label: "Clinics & pharmacies",
    summary:
      "Practices that need clearer appointment handling without replacing clinical systems.",
    solutions: [
      "Patient enquiry and booking capture",
      "Reminder and recall automations",
      "Simple admin dashboards",
      "Forms and consent-friendly flows",
    ],
    setupEstimate: "R8,500 – R22,000",
    monthlyEstimate: "R450 – R1,200",
    yearOneGuide: "R13,900 – R36,400",
    monthlyNote: "Hosting, integrations, compliance-minded copy updates.",
  },
  {
    id: "restaurants",
    label: "Restaurants & takeaways",
    summary:
      "Food businesses tired of missed calls, scattered orders and manual specials lists.",
    solutions: [
      "Menu-led landing pages or ordering enquiry flows",
      "WhatsApp order capture and FAQs",
      "Daily specials or hours updates",
      "Light reporting for busy periods",
    ],
    setupEstimate: "R4,500 – R14,000",
    monthlyEstimate: "R300 – R850",
    yearOneGuide: "R8,100 – R24,200",
    monthlyNote: "Hosting, menu edits, messaging and seasonal updates.",
  },
  {
    id: "services",
    label: "Service businesses",
    summary:
      "Plumbers, cleaners, installers and similar teams quoting and scheduling on the fly.",
    solutions: [
      "Enquiry forms tied to job pipelines",
      "Quote request and follow-up automations",
      "Field-friendly mobile dashboards",
      "Customer status updates via WhatsApp or email",
    ],
    setupEstimate: "R6,500 – R16,500",
    monthlyEstimate: "R350 – R900",
    yearOneGuide: "R10,700 – R27,300",
    monthlyNote: "Hosting, automations, minor workflow adjustments.",
  },
  {
    id: "retail",
    label: "Retail teams",
    summary:
      "Shops balancing stock questions, orders and staff coordination across channels.",
    solutions: [
      "Product enquiry and catalogue pages",
      "Order or stock-request workflows",
      "Staff-facing admin views",
      "Customer follow-up after purchase",
    ],
    setupEstimate: "R5,500 – R15,500",
    monthlyEstimate: "R400 – R1,000",
    yearOneGuide: "R10,300 – R27,500",
    monthlyNote: "Hosting, catalogue updates, integrations where needed.",
  },
] as const;

export const PRICING_CATEGORY_INTRO = {
  heading: "Built for businesses where admin costs money",
  body:
    "Missed messages, slow follow-ups, manual bookings and messy spreadsheets quietly drain time. Below are typical digital solutions we build by sector — with indicative setup, monthly and year-one figures to help you orient.",
  chips: [
    "Salons & barbers",
    "Clinics & pharmacies",
    "Restaurants & takeaways",
    "Service businesses",
    "Retail teams",
    "Small teams with too much admin",
    "Owners who want cleaner operations",
  ] as const,
};

export const PRICING_TIERS = [
  {
    id: "starter",
    title: "Starter Website",
    price: "From R3,500",
    estimateNote: "Typical starting estimate for a focused one-page build",
    description:
      "A clean premium landing page for businesses that need a sharper online presence.",
    includes: [
      "Mobile-first landing page",
      "Contact or enquiry form",
      "Basic SEO structure",
      "Fast modern build",
    ],
    cta: "Start here",
    featured: false,
  },
  {
    id: "business",
    title: "Business System",
    price: "From R7,500",
    estimateNote: "Typical starting estimate for a dashboard or workflow build",
    description:
      "Dashboards, booking flows and automations for teams that need smoother operations.",
    includes: [
      "Dashboard or workflow build",
      "WhatsApp/customer flow planning",
      "Forms and automations",
      "Admin-friendly structure",
    ],
    cta: "Build a system",
    featured: true,
  },
  {
    id: "custom",
    title: "Custom Operations Tool",
    price: "Custom quote",
    estimateNote: "Scoped after discovery — every workflow is different",
    description:
      "For businesses with a specific process, internal tool or multi-step workflow.",
    includes: [
      "Custom planning",
      "Data/workflow mapping",
      "Tailored interface",
      "Integration-ready structure",
    ],
    cta: "Discuss project",
    featured: false,
  },
] as const;

export const PRICING_FACTORS = [
  {
    title: "Scope & complexity",
    body: "More pages, roles, approval steps or data sources usually mean more build time.",
  },
  {
    title: "Integrations",
    body: "WhatsApp, payments, existing spreadsheets, POS or third-party tools affect effort.",
  },
  {
    title: "Content readiness",
    body: "Copy, imagery and brand assets supplied upfront often reduce revision rounds.",
  },
  {
    title: "Automation depth",
    body: "Reminders, loyalty, reporting and multi-step flows vary widely between clients.",
  },
  {
    title: "Timeline & support",
    body: "Rush delivery, training and ongoing tweaks are quoted separately when needed.",
  },
  {
    title: "Team structure",
    body: "Single-location salons, multi-branch teams and mixed retail/service setups differ.",
  },
] as const;

export const PRICING_GENERAL_POINTS = [
  "Every client brief is different — these tiers are orientation, not fixed packages.",
  "We quote properly after a short discovery call or message thread.",
  "Most projects land inside a range; some need less, some need more.",
  "You will always receive a written estimate before any build starts.",
  "Upgrades, add-ons and phased rollouts can spread cost over time.",
] as const;

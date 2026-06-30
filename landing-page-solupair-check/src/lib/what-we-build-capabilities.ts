export type CapabilityAccent = "cyan" | "purple" | "magenta";

/** Left-column narrative spine for the What we build section. */
export const WHAT_WE_BUILD_SPINE = {
  headline: "Digital systems that remove business friction",
  lead:
    "From first impression to daily operations, Solupair builds the tools that help businesses get found, get booked, get organised and move faster.",
  path:
    "Start with a website. Add a dashboard. Connect WhatsApp. Automate the work that keeps repeating.",
} as const;

export type WhatWeBuildCapability = {
  id: string;
  index: string;
  category: string;
  title: string;
  description: string;
  accent: CapabilityAccent;
};

export const WHAT_WE_BUILD_CAPABILITIES: readonly WhatWeBuildCapability[] = [
  {
    id: "attract",
    index: "01",
    category: "Attract",
    title: "Websites that convert",
    description:
      "Premium landing pages and business websites built to create trust, explain your offer clearly and turn visitors into enquiries.",
    accent: "cyan",
  },
  {
    id: "reveal",
    index: "02",
    category: "Reveal",
    title: "Dashboards that show the truth",
    description:
      "Live dashboards for bookings, stock, revenue, team activity and performance, so owners can see what is happening before it becomes a problem.",
    accent: "purple",
  },
  {
    id: "respond",
    index: "03",
    category: "Respond",
    title: "WhatsApp flows that work",
    description:
      "Booking flows, reminders, FAQs, customer updates and loyalty journeys built inside the channel your customers already use.",
    accent: "magenta",
  },
  {
    id: "automate",
    index: "04",
    category: "Automate",
    title: "Workflows that remove admin",
    description:
      "Systems that reduce repeated follow-ups, missed messages, manual spreadsheets and the small admin leaks that quietly waste time.",
    accent: "cyan",
  },
] as const;

/**
 * Customer-facing strings aligned with MarineFlow WhatsApp bot:
 * - src/lib/hierarchicalMenu.ts (main menu)
 * - src/services/bot.ts (booking hints, confirm, POPIA)
 * - src/services/personalization.ts (greetings)
 */

export const DEMO_SALON_NAME = "Glow Beauty Studio";

/** Landing page project slide title — paired with WhatsApp chatbot showcase. */
export const WHATSAPP_AGENT_NAME = "WhatsApp Agent";

/** buildMainMenuText() — salon industry template defaults (book an appointment). */
export function demoMainMenuBody(): string {
  return [
    `Welcome to ${DEMO_SALON_NAME}! Reply with a number:`,
    "1 — Book an appointment",
    "2 — My Bookings",
    "3 — Services",
    "4 — Rewards",
    "5 — Promotions",
    "6 — About Us",
    "7 — Support",
    "",
    '💬 Or just tell me what you need — e.g. "Monday 15:00 low fade" — and I\'ll book it for you.',
    "Reply BACK anytime for this menu.",
  ].join("\n");
}

/** New-customer greeting — bot.ts sendGreeting() */
export const demoNewCustomerGreeting = `Good afternoon! 👋 Welcome to *${DEMO_SALON_NAME}* — we're happy to have you!\n\nLet's get you set up.`;

/** botInteractiveMenus / PICK_SERVICE */
export const demoPickServiceBody = [
  "Pick a service:",
  "1. Ladies Cut — R450",
  "2. Full Colour — R890",
  "3. Treatment — R320",
].join("\n");

/** formatSlotMenuLines + APPOINTMENT_SLOT_HINT — bot.ts */
export const demoPickSlotBody = [
  "Pick a time:",
  "1. Today 10:30",
  "2. Today 14:00",
  "3. Tomorrow 09:00",
  "",
  "💬 Or type a time — e.g. *14:00* or *2pm* — or a full date & time for another day.",
].join("\n");

/** buildConfirmBookingBody() — bot.ts */
export const demoConfirmBookingBody = [
  "Great choice! *Sam*, please check your booking:",
  "",
  "📋 *Ladies Cut*",
  "👤 with Thandi",
  "📅 Thursday, 14 March 2026",
  "🕐 10:30 – 11:30",
  "💰 R450",
  "",
  "Tap *Yes, confirm* below to complete your booking.",
].join("\n");

/** Post-confirm — bot.ts onBookingConfirmed reply */
export const demoBookingConfirmedBody = [
  "✅ *You're all set, Sam!*",
  "",
  "📋 *Ladies Cut*",
  "👤 with Thandi",
  "📅 Thursday, 14 March 2026",
  "🕐 10:30 – 11:30",
  "",
  "🔖 Ref: *A1B2C3D4*",
  "",
  "_See you then, Sam! Reply *MENU* anytime to manage your bookings._",
].join("\n");

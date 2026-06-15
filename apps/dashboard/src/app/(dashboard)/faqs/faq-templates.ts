export interface FaqTemplate {
  question: string;
  answer: string;
  category: string;
  businessTypes: string[];
}

// ── Universal templates (all business types) ─────────────────────────────────

const UNIVERSAL: FaqTemplate[] = [
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'What are your opening hours?',
    answer: `We're open:\n🗓 Monday – Friday: [e.g. 9:00 AM – 6:00 PM]\n🗓 Saturday: [e.g. 8:00 AM – 5:00 PM]\n🗓 Sunday: [e.g. 10:00 AM – 3:00 PM]\n\nHours may differ on public holidays — message us to confirm.`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'Are you open on public holidays?',
    answer: `Our public holiday hours vary. We recommend messaging us before your visit to confirm availability. Some holidays we operate on reduced hours ([TIME] – [TIME]).`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'Where are you located?',
    answer: `We're located at [FULL ADDRESS, e.g. 12 Rose Street, Sandton, Johannesburg, 2196].\n\n📍 Landmark: [e.g. Next to the Pick n Pay on Main Road]\n\nNeed directions? Drop us a message and we'll guide you!`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'Is there parking available?',
    answer: `Yes, [FREE/PAID] parking is available [on-site / across the street / in the parking garage on [STREET NAME]].\n\n[Add any extra details, e.g. "There are 10 dedicated bays in front of the building."]`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'How do I get there by public transport?',
    answer: `We're easily accessible by public transport:\n🚌 Bus: [ROUTE NAME/NUMBER] stops [X] metres from us\n🚇 Taxi: [TAXI RANK NAME] is [X] minutes walk away\n🚂 Train: [STATION NAME] is the closest station\n\nMessage us if you need more specific directions!`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'What is your contact number?',
    answer: `You can reach us on:\n📞 [PHONE NUMBER]\n💬 WhatsApp: [WHATSAPP NUMBER]\n📧 Email: [EMAIL ADDRESS]\n\nWe're quickest to respond via WhatsApp during business hours.`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'How do I book via WhatsApp?',
    answer: `Booking via WhatsApp is easy! Simply:\n1️⃣ Send us a message on this number\n2️⃣ Our assistant will guide you through selecting a service, date and time\n3️⃣ You'll receive a confirmation once your booking is secured\n\nWe recommend booking at least [X days] in advance, especially for weekends.`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'How do I make a booking?',
    answer: `You can book in several ways:\n1️⃣ Reply to this WhatsApp chat\n2️⃣ Call us on [PHONE NUMBER]\n3️⃣ Visit us in person at [ADDRESS]\n4️⃣ Book online at [WEBSITE URL]\n\nWe recommend booking ahead to secure your preferred time slot.`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'What is your cancellation policy?',
    answer: `We ask for at least 24 hours notice for cancellations.\n\n🔴 Late cancellations (less than 24 hours): [online payment is non-refundable / a [R AMOUNT] cancellation fee applies]\n🔴 No-shows: [payment is forfeited / full service fee may be charged for future bookings]\n\nWe understand emergencies happen — please let us know as soon as possible.`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'Can I reschedule my appointment?',
    answer: `Yes — life happens! Please give us at least 24 hours notice so we can offer the slot to someone else.\n\n📲 To reschedule: reply to this chat or call [PHONE NUMBER]\n\nOnline payments can be transferred to a rescheduled appointment when sufficient notice is given.`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'Do you require payment to book?',
    answer: `Yes — we require full payment via PayFast to secure your appointment.\n\n💳 You pay the full service price when you confirm your booking on WhatsApp.\n\nPayment is [refundable with 24 hours notice / non-refundable for late cancellations or no-shows].\n\nA PayFast link is sent right after you confirm your booking.`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'What payment methods do you accept?',
    answer: `We accept the following payment methods:\n\n💵 Cash\n💳 Credit & Debit card (Visa, Mastercard)\n📱 SnapScan / Zapper\n🏦 EFT / Bank transfer\n\nWe do not currently accept cheques. Payment is due at time of service.`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'What should I bring to my appointment?',
    answer: `For your appointment, please bring:\n\n✅ A valid ID or proof of booking\n✅ Proof of payment (if applicable)\n✅ Any relevant documents or referrals\n✅ Comfortable clothing suitable for your service\n\nWe'll take care of the rest!`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'Do you accept walk-ins?',
    answer: `We do accept walk-ins [when available], but we can't always guarantee immediate availability — especially on weekends.\n\nTo avoid waiting, we recommend booking ahead. Reply here or call [PHONE NUMBER] to check same-day availability.`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'What hygiene and safety protocols do you follow?',
    answer: `We take cleanliness very seriously:\n\n🧹 All equipment is sanitised between every client\n🧹 Work surfaces are cleaned and disinfected after each appointment\n🧹 Staff practice thorough hand hygiene\n🧹 We follow all relevant health and safety regulations\n\nYour health and safety is our top priority.`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'Do you have social media pages I can follow?',
    answer: `Yes! Follow us for updates, promotions and behind-the-scenes content:\n\n📸 Instagram: @[HANDLE]\n👍 Facebook: [PAGE NAME]\n🎵 TikTok: @[HANDLE]\n\nTag us in your photos using #[HASHTAG] — we love seeing happy customers!`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'Do you offer gift vouchers?',
    answer: `Yes! Our gift vouchers make perfect presents 🎁\n\nAvailable in any amount from R[MINIMUM AMOUNT].\n\nTo purchase:\n📲 Message us on this chat\n📞 Call [PHONE NUMBER]\n🏠 Visit us in person\n\nVouchers are valid for [12 months] from date of purchase and can be redeemed for any service.`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'Do you have a loyalty programme?',
    answer: `Yes! We reward our loyal customers 🌟\n\nHow it works:\n💚 Earn [1 stamp / point] per qualifying visit or purchase\n💚 Collect [X stamps] to earn [a free service / [X]% discount]\n\nAsk us how to join, or enquire via this chat.`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'What happens if I arrive late?',
    answer: `Please let us know as soon as possible if you're running late.\n\n⏰ We can usually accommodate up to [15] minutes late.\n⚠️ If you're more than [20] minutes late, we may need to shorten or reschedule your appointment to be fair to the next client.`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'What is your refund policy?',
    answer: `Your satisfaction is our priority. If you're unhappy with our service, please let us know [immediately / within [X] days] so we can make it right.\n\n✅ We offer complimentary corrections if the service wasn't completed to spec\n❌ We don't offer cash refunds for services already rendered\n\nPlease raise any concerns with us directly and we'll do our best to resolve them.`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'How do I make a complaint?',
    answer: `We're sorry to hear if something wasn't up to standard. We take all feedback seriously.\n\n📞 Call us: [PHONE NUMBER]\n📧 Email: [EMAIL ADDRESS]\n💬 WhatsApp: [WHATSAPP NUMBER]\n\nWe aim to resolve all complaints within 24–48 hours and will do our best to make things right.`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'Do you have an online booking link?',
    answer: `Yes! You can book online at:\n🔗 [WEBSITE URL / BOOKING PLATFORM LINK]\n\nOnline bookings are available [24/7 / during business hours]. Alternatively, reply to this WhatsApp chat and we'll book you manually.`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'How do I stay updated on your news and promotions?',
    answer: `Stay in the loop:\n\n📲 Follow us on Instagram @[HANDLE] and Facebook [PAGE NAME]\n💬 Reply "SUBSCRIBE" to this chat to get our WhatsApp updates\n📧 Email us at [EMAIL] to join our newsletter\n\nWe share specials, new services, and tips regularly!`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: "I'm a first-time customer — what should I know?",
    answer: `Welcome! Here's everything you need to know:\n\n✅ Book your appointment [online / via WhatsApp / by calling [PHONE NUMBER]]\n✅ Arrive [X minutes] early so we can get started on time\n✅ Bring [any relevant documents / proof of booking / ID]\n✅ Full payment via PayFast is required to secure your booking\n\nWe're excited to have you — don't hesitate to ask us anything!`,
  },
  {
    category: 'General',
    businessTypes: ['All'],
    question: 'Are you a registered business?',
    answer: `Yes, we are a fully registered South African business.\n\n📋 Registration number: [REG NUMBER]\n📋 VAT number: [VAT NUMBER if applicable]\n\nWe comply with all relevant health, safety, and business regulations.`,
  },
];

// ── Food & Beverage ───────────────────────────────────────────────────────────

const RESTAURANT: FaqTemplate[] = [
  {
    category: 'Reservations',
    businessTypes: ['Restaurant & Café', 'Pizzeria'],
    question: 'How do I make a reservation?',
    answer: `You can make a reservation by:\n\n📲 Replying to this WhatsApp chat\n📞 Calling us on [PHONE NUMBER]\n🌐 Booking online at [WEBSITE / BOOKING PLATFORM]\n\nWe recommend booking ahead, especially for weekends and public holidays.`,
  },
  {
    category: 'Reservations',
    businessTypes: ['Restaurant & Café', 'Pizzeria'],
    question: 'Can you accommodate large groups?',
    answer: `Yes! We can accommodate groups of up to [X] people. For groups larger than [X], please contact us directly on [PHONE NUMBER] to discuss arrangements and ensure we have the right space available.\n\nWe recommend booking group reservations at least [1 week] in advance.`,
  },
  {
    category: 'Menu',
    businessTypes: ['Restaurant & Café', 'Coffee Shop', 'Pizzeria', 'Takeaway Restaurant', 'Fast Food Outlet'],
    question: 'Do you cater for dietary restrictions (halal, vegan, gluten-free)?',
    answer: `Yes! We offer options for a variety of dietary needs:\n\n🌱 Vegan: [YES/ASK US]\n🌾 Gluten-free: [YES/ASK US]\n☪️ Halal: [YES/CERTIFIED]\n🥛 Dairy-free: [YES/ASK US]\n\nPlease inform your server or let us know when booking so we can accommodate you properly.`,
  },
  {
    category: 'Menu',
    businessTypes: ['Restaurant & Café'],
    question: 'Do you have a kids menu?',
    answer: `Yes! We have a dedicated kids menu with [small portions / child-friendly options] starting from R[AMOUNT].\n\nWe also have [high chairs / booster seats] available — just let us know when booking.`,
  },
  {
    category: 'Menu',
    businessTypes: ['Restaurant & Café'],
    question: 'Can I bring my own wine (BYO)? Is there a corkage fee?',
    answer: `[Yes, we are BYO-friendly! We charge a corkage fee of R[AMOUNT] per bottle.]\n\n[We have a full liquor licence so unfortunately we do not allow BYO.]\n\nPlease let us know in advance if you plan to bring your own wine.`,
  },
  {
    category: 'Bookings',
    businessTypes: ['Restaurant & Café'],
    question: 'Can you host functions or private events?',
    answer: `Yes! We offer private dining and function packages for:\n\n🎉 Birthday parties\n💍 Engagements & anniversaries\n🏢 Corporate lunches & dinners\n👨‍👩‍👧 Family celebrations\n\nPlease contact us on [PHONE NUMBER] or [EMAIL] to discuss your event and get a quote.`,
  },
  {
    category: 'Menu',
    businessTypes: ['Restaurant & Café'],
    question: 'Do you offer delivery?',
    answer: `[Yes! We deliver via [Mr D / Uber Eats / our own drivers] within [X km] of our restaurant. Minimum order: R[AMOUNT]. Delivery fee: R[AMOUNT].]\n\n[We are available on Mr D Food and Uber Eats — search for [RESTAURANT NAME]]\n\n[We currently only offer dine-in and takeaway.]`,
  },
  {
    category: 'Menu',
    businessTypes: ['Restaurant & Café', 'Catering Company'],
    question: 'Do you offer catering for events?',
    answer: `Yes! Our catering team can handle events of all sizes.\n\nWe offer:\n🍽️ Sit-down meals\n🥘 Buffet-style service\n🥗 Platters and finger foods\n\nContact us on [PHONE NUMBER] or [EMAIL] to discuss your event, guest numbers, and menu preferences.`,
  },
];

const BAKERY: FaqTemplate[] = [
  {
    category: 'Custom Orders',
    businessTypes: ['Bakery'],
    question: 'Can I order a custom cake? How much notice do you need?',
    answer: `Yes! We love creating custom cakes 🎂\n\nWe require:\n📅 Standard custom cakes: at least [3–5 days] notice\n📅 Wedding / tiered cakes: at least [2–4 weeks] notice\n\nTo order, send us a message with your event date, design ideas, flavour preferences, and number of portions. Prices start from R[AMOUNT].`,
  },
  {
    category: 'Menu',
    businessTypes: ['Bakery'],
    question: 'Do you offer gluten-free or allergy-friendly baked goods?',
    answer: `Yes! We offer [gluten-free / nut-free / dairy-free] options. Please note that our kitchen [does / does not] handle allergens, so cross-contamination may occur.\n\nAlways inform us of your allergies when ordering so we can advise you properly.`,
  },
  {
    category: 'Orders',
    businessTypes: ['Bakery'],
    question: 'Can I pre-order fresh bread daily?',
    answer: `Yes! Pre-orders for fresh bread are taken [the evening before / by [TIME] the morning of].\n\nSimply message us your order and we'll have it ready for collection at [TIME].\n\nAvailable varieties: [list breads]`,
  },
  {
    category: 'Custom Orders',
    businessTypes: ['Bakery'],
    question: 'Do you do wedding cake consultations?',
    answer: `Yes! We offer [complimentary / R[AMOUNT]] wedding cake consultations including cake tasting.\n\nDuring your consultation we'll discuss:\n🎂 Design and tiers\n🎂 Flavour combinations\n🎂 Portion sizes\n🎂 Delivery and setup options\n\nBook your consultation at least [4–6 weeks] before your wedding date.`,
  },
  {
    category: 'Menu',
    businessTypes: ['Bakery'],
    question: 'Do you provide allergen information for your products?',
    answer: `Yes! We can provide full allergen information for any of our products.\n\nCommon allergens in our kitchen: gluten, eggs, dairy, nuts, soy.\n\nPlease ask before purchasing if you have any allergies or dietary requirements.`,
  },
];

const CATERING: FaqTemplate[] = [
  {
    category: 'Bookings',
    businessTypes: ['Catering Company', 'Meal Prep Service', 'Private Chef'],
    question: 'What is your minimum guest number for catering?',
    answer: `Our minimum for catering events is [X] guests. For smaller gatherings, we also offer platter and box meal options.\n\nContact us on [PHONE NUMBER] to discuss your specific needs and get a tailored quote.`,
  },
  {
    category: 'Bookings',
    businessTypes: ['Catering Company'],
    question: 'Do you require full payment for catering bookings?',
    answer: `Yes. We require full payment via PayFast to confirm your catering booking.\n\nPayment is non-refundable if cancelled within [X days] of the event.`,
  },
  {
    category: 'Menu',
    businessTypes: ['Catering Company'],
    question: 'Can we arrange a menu tasting before the event?',
    answer: `Yes! We offer menu tastings for events of [X+] guests. A tasting fee of R[AMOUNT] applies (deducted from your final invoice).\n\nTastings must be arranged at least [2 weeks] before your event date. Contact us to schedule.`,
  },
  {
    category: 'Logistics',
    businessTypes: ['Catering Company'],
    question: 'Can clients supply their own drinks?',
    answer: `[Yes, clients are welcome to supply their own beverages. We do not charge a corkage fee for catering events.]\n\n[We can supply beverages as part of your catering package — ask us for our drinks menu and pricing.]`,
  },
  {
    category: 'Logistics',
    businessTypes: ['Catering Company'],
    question: 'Is equipment hire included in the catering package?',
    answer: `[Yes! Our packages include tables, chairs, linen, crockery, cutlery, and chafing dishes.]\n\n[Basic equipment (chafing dishes, serving utensils) is included. Additional furniture (tables, chairs, linen) can be hired at an extra cost.]\n\nLet us know what you need and we'll provide a detailed quote.`,
  },
];

// ── Hair & Beauty ─────────────────────────────────────────────────────────────

const HAIR_SALON: FaqTemplate[] = [
  {
    category: 'Services',
    businessTypes: ['Hair Salon'],
    question: 'Do I need a consultation before a colour treatment?',
    answer: `Yes! We recommend a consultation before any colour treatment, especially for:\n\n🎨 Significant colour changes (going lighter or darker)\n🎨 First-time colour clients\n🎨 Colour corrections\n\nA consultation allows us to assess your hair condition, discuss your goals, and give you an accurate quote. Consultations are [free / R[AMOUNT]].`,
  },
  {
    category: 'Services',
    businessTypes: ['Hair Salon'],
    question: 'Do you specialise in natural hair care?',
    answer: `Yes! Our stylists are experienced with all natural hair types (4A, 4B, 4C).\n\nNatural hair services include:\n🌿 Wash & go\n🌿 Protective styles (twists, braids, locs)\n🌿 Deep conditioning treatments\n🌿 Big chop consultations\n🌿 Natural hair education`,
  },
  {
    category: 'Services',
    businessTypes: ['Hair Salon'],
    question: 'What types of hair extensions do you offer?',
    answer: `We offer a range of extension methods:\n\n💇 Sew-in weave: from R[AMOUNT]\n💇 Tape-in extensions: from R[AMOUNT]\n💇 Clip-in extensions: from R[AMOUNT]\n💇 Micro-bead extensions: from R[AMOUNT]\n\nWe recommend a consultation to determine the best method for your hair type and lifestyle.`,
  },
  {
    category: 'Services',
    businessTypes: ['Hair Salon'],
    question: 'How long does a relaxer take?',
    answer: `A relaxer service typically takes [1.5 – 2.5 hours] depending on:\n\n• Hair thickness and length\n• New growth amount\n• Any additional treatments (conditioning, blow-dry)\n\nWe'll give you a more accurate time estimate when you book.`,
  },
  {
    category: 'Safety',
    businessTypes: ['Hair Salon'],
    question: 'Do you do patch tests before chemical treatments?',
    answer: `Yes! For safety, we perform a patch test [48 hours] before any chemical service (colour, relaxer, keratin) for:\n\n🔬 New clients\n🔬 Clients who haven't had chemical treatments in [12+ months]\n\nPlease visit us [2 days before] your appointment for the patch test.`,
  },
];

const LASH_STUDIO: FaqTemplate[] = [
  {
    category: 'Services',
    businessTypes: ['Lash Studio'],
    question: 'How long do lash extensions last?',
    answer: `Lash extensions typically last [3–4 weeks] depending on your natural lash cycle, lifestyle, and aftercare.\n\nWe recommend a lash fill every [2–3 weeks] to keep them looking full and fresh.`,
  },
  {
    category: 'Aftercare',
    businessTypes: ['Lash Studio'],
    question: 'What is the aftercare for lash extensions?',
    answer: `To maintain your lash extensions:\n\n✅ Avoid water and steam for the first 24–48 hours\n✅ Do not rub or pull your lashes\n✅ Brush gently with a clean spoolie daily\n✅ Avoid oil-based products around the eye area\n✅ Sleep on your back or use a silk pillowcase`,
  },
  {
    category: 'Aftercare',
    businessTypes: ['Lash Studio'],
    question: 'Can I swim with lash extensions?',
    answer: `Yes, after the initial 24–48 hour curing period you can swim and shower normally.\n\nHowever, prolonged exposure to chlorine, saltwater, or steam may shorten the lifespan of your lashes. We recommend patting them dry after swimming rather than rubbing.`,
  },
  {
    category: 'Health',
    businessTypes: ['Lash Studio'],
    question: 'I have sensitive eyes / allergies. Can I still get lash extensions?',
    answer: `Many clients with sensitive eyes enjoy lash extensions. However, if you have a known allergy to adhesive or formaldehyde, extensions may not be suitable.\n\nWe recommend a patch test [24–48 hours] before your full set. Please disclose any allergies or sensitivities when booking.`,
  },
  {
    category: 'Bookings',
    businessTypes: ['Lash Studio'],
    question: 'When should I come in for a lash fill?',
    answer: `We recommend coming in for a fill every [2–3 weeks]. By week 3–4 your natural lash shed cycle will have reduced fullness significantly.\n\nIf more than [4 weeks] have passed, a full set may be required rather than a fill.`,
  },
];

const MAKEUP_ARTIST: FaqTemplate[] = [
  {
    category: 'Preparation',
    businessTypes: ['Makeup Artist'],
    question: 'What should I bring to my makeup appointment?',
    answer: `Please arrive with:\n\n✅ Clean, moisturised skin (no heavy skincare)\n✅ Reference photos of your desired look\n✅ Any skincare products you normally use (for sensitive skin)\n\nWear a button-up top so getting changed doesn't disturb your makeup.`,
  },
  {
    category: 'Services',
    businessTypes: ['Makeup Artist'],
    question: 'Do you offer airbrush makeup?',
    answer: `Yes! We offer both traditional and airbrush makeup application.\n\n💨 Airbrush: lighter finish, long-lasting, great for events and weddings — R[AMOUNT]\n💄 Traditional: buildable coverage, versatile — from R[AMOUNT]\n\nNot sure which to choose? Ask us during your consultation!`,
  },
  {
    category: 'Weddings',
    businessTypes: ['Makeup Artist'],
    question: 'Do you require a makeup trial for weddings?',
    answer: `Yes, we strongly recommend a makeup trial for all brides. This ensures you love your look on the day and gives us time to perfect it.\n\nTrials are done [4–8 weeks] before the wedding. Bridal trial fee: R[AMOUNT] (applied toward wedding day booking).`,
  },
  {
    category: 'Bookings',
    businessTypes: ['Makeup Artist'],
    question: 'How far in advance should I book for my event?',
    answer: `We recommend booking:\n\n👰 Weddings: [3–6 months] in advance\n🎉 Events & functions: [2–4 weeks] in advance\n📸 Photo shoots: [1–2 weeks] in advance\n\nPeak season (September–April) books up very fast — secure your date early!`,
  },
  {
    category: 'Logistics',
    businessTypes: ['Makeup Artist'],
    question: 'Do you charge a travel fee?',
    answer: `Travel within [X km] of [AREA] is free. Beyond that:\n\n🚗 [X]–[X] km: R[AMOUNT]\n🚗 [X]+ km: R[AMOUNT] per km\n\nFor destination events outside [CITY], please contact us for a custom quote.`,
  },
];

const WAXING_STUDIO: FaqTemplate[] = [
  {
    category: 'Preparation',
    businessTypes: ['Waxing Studio', 'Beauty Salon'],
    question: 'How long should my hair be before waxing?',
    answer: `For best results, hair should be at least [0.5 – 1 cm] long (roughly 2–3 weeks of growth after shaving).\n\nIf hair is too short, the wax won't grip effectively. If too long, we can trim it down before your appointment.`,
  },
  {
    category: 'Preparation',
    businessTypes: ['Waxing Studio'],
    question: 'Can I take painkillers before a wax?',
    answer: `Yes, taking an over-the-counter painkiller (like ibuprofen) 30–45 minutes before your waxing appointment can help reduce discomfort.\n\nAvoid alcohol before your appointment as it can make skin more sensitive.`,
  },
  {
    category: 'Health',
    businessTypes: ['Waxing Studio'],
    question: 'Can I be waxed during my period or while pregnant?',
    answer: `Period: Yes, however skin can be more sensitive during your cycle. You may experience more discomfort than usual.\n\nPregnancy: We can wax during pregnancy but skin may be more sensitive. Please let us know when booking so we can take extra care.`,
  },
  {
    category: 'Services',
    businessTypes: ['Waxing Studio', 'Beauty Salon'],
    question: 'Do you offer male waxing?',
    answer: `Yes! We offer waxing services for men including:\n\n✅ Back & shoulders\n✅ Chest & stomach\n✅ Arms & legs\n✅ Eyebrow shaping\n\nAll services are performed professionally and with full privacy.`,
  },
];

// ── Aesthetic & Skincare ──────────────────────────────────────────────────────

const AESTHETIC_CLINIC: FaqTemplate[] = [
  {
    category: 'Treatments',
    businessTypes: ['Aesthetic Clinic'],
    question: 'Are your treatments performed by a doctor?',
    answer: `Yes. All injectables and medical aesthetic treatments at our clinic are performed by a qualified [doctor / nurse / medical professional] registered with the [HPCSA / SANC].\n\nYour safety is our first priority — we do not allow unqualified staff to perform medical procedures.`,
  },
  {
    category: 'Treatments',
    businessTypes: ['Aesthetic Clinic'],
    question: 'What is Botox and what does it treat?',
    answer: `Botox (botulinum toxin) is an injectable treatment that temporarily relaxes muscles to reduce:\n\n✨ Frown lines (between the brows)\n✨ Forehead lines\n✨ Crow's feet (around the eyes)\n\nResults typically last [3–4 months]. Treatment takes about [15–30 minutes] with minimal downtime.`,
  },
  {
    category: 'Treatments',
    businessTypes: ['Aesthetic Clinic'],
    question: 'What is the downtime after aesthetic treatments?',
    answer: `Downtime varies by treatment:\n\n💉 Botox: Minimal — minor swelling/bruising possible, resolves in 1–3 days\n💉 Dermal fillers: Swelling and bruising possible for 3–7 days\n🌿 Chemical peels: Peeling for 3–7 days depending on depth\n✨ Laser: Redness for 1–3 days\n\nWe'll provide full aftercare instructions at your appointment.`,
  },
  {
    category: 'Safety',
    businessTypes: ['Aesthetic Clinic'],
    question: 'Are there contraindications for aesthetic treatments?',
    answer: `Yes. Certain conditions may prevent you from having specific treatments, including:\n\n❌ Pregnancy or breastfeeding\n❌ Active skin infections\n❌ Certain autoimmune conditions\n❌ Blood thinning medications\n\nPlease disclose your full medical history during your consultation. We will not proceed if treatment is not safe for you.`,
  },
  {
    category: 'Pricing',
    businessTypes: ['Aesthetic Clinic', 'Skincare Clinic'],
    question: 'Do you offer treatment packages?',
    answer: `Yes! We offer discounted packages for:\n\n📦 Course of [X] treatments: [X]% saving\n📦 Combination packages (e.g. Botox + filler): from R[AMOUNT]\n📦 Seasonal specials — follow us @[HANDLE] for updates\n\nAsk us about our current package deals when you book.`,
  },
];

// ── Wellness & Spa ────────────────────────────────────────────────────────────

const MASSAGE: FaqTemplate[] = [
  {
    category: 'Preparation',
    businessTypes: ['Massage Parlour', 'Day Spa', 'Wellness Centre'],
    question: 'What should I wear during a massage?',
    answer: `You will be professionally draped (covered with a towel or sheet) throughout your massage — only the area being worked on will be exposed.\n\nYou can undress to your comfort level. Most clients remove clothing, but underwear can be kept on if preferred.`,
  },
  {
    category: 'Preparation',
    businessTypes: ['Massage Parlour', 'Day Spa', 'Wellness Centre'],
    question: 'Should I arrive early for my massage?',
    answer: `Yes! Please arrive [10–15 minutes] before your appointment to:\n\n✅ Complete a health intake form\n✅ Discuss any areas of focus or concern with your therapist\n✅ Relax and transition from your busy day\n\nArriving late may shorten your treatment time.`,
  },
  {
    category: 'Health',
    businessTypes: ['Massage Parlour', 'Day Spa'],
    question: 'Can I get a massage while pregnant?',
    answer: `Yes! We offer pregnancy massage from the [second trimester] onward. Our therapists are trained in safe positioning and techniques for expectant mothers.\n\nPlease let us know you are pregnant when booking so we can allocate the appropriate therapist and prepare correctly.`,
  },
  {
    category: 'Health',
    businessTypes: ['Massage Parlour', 'Day Spa', 'Wellness Centre'],
    question: 'Are there contraindications for massage?',
    answer: `Massage may not be appropriate in certain cases including:\n\n❌ Active fever or infection\n❌ Blood clots or DVT\n❌ Open wounds or skin infections\n❌ Recent surgery (within [6 weeks])\n❌ Certain cardiovascular conditions\n\nPlease disclose your full health history on your intake form. Your therapist will advise if any modifications are needed.`,
  },
];

// ── Health & Allied Health ────────────────────────────────────────────────────

const PHYSIO: FaqTemplate[] = [
  {
    category: 'Bookings',
    businessTypes: ['Physiotherapy', 'Biokinetics'],
    question: 'Do I need a referral to see a physiotherapist?',
    answer: `No referral is needed to book an appointment with us — you can contact us directly.\n\nHowever, if you plan to claim from medical aid, some schemes may require a referral from your GP. We recommend checking with your medical aid scheme first.`,
  },
  {
    category: 'Medical Aid',
    businessTypes: ['Physiotherapy', 'Biokinetics', 'Occupational Therapy', 'Speech Therapy', 'Audiology'],
    question: 'Do you accept medical aid?',
    answer: `Yes! We are registered with most major medical aid schemes including [list schemes, e.g. Discovery, Momentum, Bonitas, Medihelp, GEMS].\n\nPlease bring your medical aid card and member details to your appointment. We will assist with direct claims where possible.`,
  },
  {
    category: 'First Visit',
    businessTypes: ['Physiotherapy'],
    question: 'How long will my initial assessment take?',
    answer: `Your initial assessment appointment is typically [45–60 minutes] and includes:\n\n📋 Full medical history\n🔍 Physical examination and movement assessment\n📊 Diagnosis and treatment plan discussion\n💆 First treatment session\n\nFollow-up sessions are usually [30–45 minutes].`,
  },
  {
    category: 'First Visit',
    businessTypes: ['Physiotherapy'],
    question: 'Should I bring my X-rays or scan results?',
    answer: `Yes, please bring any relevant imaging (X-rays, MRI, CT scans) and previous medical reports to your first appointment.\n\nThis helps our therapist understand your history and create the most effective treatment plan for you.`,
  },
  {
    category: 'Treatment',
    businessTypes: ['Physiotherapy', 'Chiropractic', 'Biokinetics'],
    question: 'How many sessions will I need?',
    answer: `The number of sessions depends on your condition and response to treatment.\n\nAfter your initial assessment, your therapist will give you a recommended treatment plan. Most acute conditions improve within [4–8 sessions], while chronic conditions may require ongoing management.`,
  },
];

const PSYCHOLOGY: FaqTemplate[] = [
  {
    category: 'Confidentiality',
    businessTypes: ['Psychology', 'Counselling'],
    question: 'Is what I share in sessions confidential?',
    answer: `Yes. Everything discussed in your sessions is strictly confidential.\n\nThe only exceptions (required by law) are:\n⚠️ Risk of serious harm to yourself or others\n⚠️ Child abuse or neglect\n⚠️ Court order\n\nConfidentiality will be discussed thoroughly in your first session.`,
  },
  {
    category: 'Format',
    businessTypes: ['Psychology', 'Counselling'],
    question: 'Are sessions available online or only in person?',
    answer: `We offer both in-person and online (video call) sessions.\n\n💻 Online sessions are conducted via [Zoom / Google Meet / Teams] and are just as effective as face-to-face therapy.\n\nLet us know your preference when booking.`,
  },
  {
    category: 'First Visit',
    businessTypes: ['Psychology', 'Counselling'],
    question: 'What happens in the first appointment?',
    answer: `Your first appointment is an intake session where we:\n\n📋 Get to know you and understand what brought you to therapy\n📋 Discuss your goals and what you hope to achieve\n📋 Explain the therapeutic process\n📋 Answer any questions you have\n\nThere's no pressure — go at your own pace.`,
  },
  {
    category: 'Medical Aid',
    businessTypes: ['Psychology', 'Counselling'],
    question: 'Can I claim therapy sessions from my medical aid?',
    answer: `Many medical aid schemes cover psychology sessions, especially from the mental health or savings benefit.\n\nWe are registered with [list schemes]. We provide detailed invoices / practice codes for you to claim.\n\nWe recommend checking with your scheme before your first appointment to understand your benefits.`,
  },
  {
    category: 'Crisis',
    businessTypes: ['Psychology', 'Counselling'],
    question: 'What if I am in crisis between sessions?',
    answer: `Your safety is our priority. If you are in crisis:\n\n🆘 SADAG Crisis Line: 0800 456 789 (free, 24/7)\n🆘 Suicide Crisis Line: 0800 567 567\n🆘 Emergency services: 10111 / 112\n\nYou can also contact your therapist directly at [CONTACT]. If you cannot reach them, please seek emergency help immediately.`,
  },
];

const OPTOMETRY: FaqTemplate[] = [
  {
    category: 'Preparation',
    businessTypes: ['Optometry'],
    question: 'Should I bring my old glasses or contact lenses?',
    answer: `Yes! Please bring your current glasses and/or contact lenses to your eye test. This helps us understand your current prescription and assess any changes needed.`,
  },
  {
    category: 'Services',
    businessTypes: ['Optometry'],
    question: "Do you test children's eyes?",
    answer: `Yes! We recommend children have their first eye test at age [3–4] and regular tests thereafter.\n\nEarly detection is important for conditions like lazy eye (amblyopia) and squint. Children under [18] must be accompanied by a parent or guardian.`,
  },
  {
    category: 'Services',
    businessTypes: ['Optometry'],
    question: 'Do you fit contact lenses?',
    answer: `Yes! We offer contact lens fitting for:\n\n👁️ Daily, weekly, and monthly lenses\n👁️ Toric lenses (for astigmatism)\n👁️ Multifocal contact lenses\n👁️ Coloured lenses\n\nA contact lens fitting is a separate consultation from a standard eye test. Ask us to include it when booking.`,
  },
  {
    category: 'Services',
    businessTypes: ['Optometry'],
    question: 'I only need reading glasses — do I still need a full eye test?',
    answer: `Yes, we recommend a full eye test even if you only need reading glasses. This ensures we identify any underlying conditions and give you the most accurate prescription.\n\nEye tests also screen for conditions like glaucoma, cataracts, and macular degeneration — many of which have no early symptoms.`,
  },
];

// ── Medical & Pharmacy ────────────────────────────────────────────────────────

const DENTAL: FaqTemplate[] = [
  {
    category: 'Medical Aid',
    businessTypes: ['Dental Practice'],
    question: 'Do you accept medical aid?',
    answer: `Yes! We are registered with most major medical aid schemes including [Discovery, Momentum, Bonitas, GEMS, Medihelp, etc.].\n\nPlease bring your medical aid card to your appointment. We will submit claims on your behalf where possible. Note that dental benefits vary by plan — we recommend checking your limits before your visit.`,
  },
  {
    category: 'Bookings',
    businessTypes: ['Dental Practice'],
    question: 'Do you handle dental emergencies?',
    answer: `Yes! We do our best to accommodate dental emergencies on the same day.\n\n🚨 For emergencies, please call [PHONE NUMBER] as early as possible.\n🚨 After hours, please [call the emergency line at [NUMBER] / visit your nearest emergency dental practice].\n\nCommon emergencies: severe toothache, broken tooth, knocked-out tooth, lost filling.`,
  },
  {
    category: 'Services',
    businessTypes: ['Dental Practice'],
    question: 'Do you offer sedation for anxious patients?',
    answer: `Yes! We understand dental anxiety is real and common.\n\nWe offer:\n😴 Oral sedation (tablets): R[AMOUNT]\n😴 Nitrous oxide (happy gas): R[AMOUNT]\n💉 IV sedation: [ask us]\n\nPlease let us know about your anxiety when booking — we'll take extra care to ensure you're comfortable.`,
  },
  {
    category: 'Services',
    businessTypes: ['Dental Practice'],
    question: 'Do you offer teeth whitening?',
    answer: `Yes! We offer:\n\n✨ In-chair whitening (results in 1 hour): from R[AMOUNT]\n✨ Take-home whitening trays: from R[AMOUNT]\n\nTeeth whitening is most effective on natural teeth and may not change the colour of crowns or veneers. A consultation is recommended first.`,
  },
  {
    category: 'Health',
    businessTypes: ['Dental Practice'],
    question: 'How should I manage dental anxiety?',
    answer: `We have helped many anxious patients enjoy stress-free dental visits:\n\n✅ Let us know — we'll work at your pace\n✅ Agree on a "stop" signal\n✅ Consider sedation options (ask us)\n✅ Bring headphones and music\n✅ Book the first appointment of the day (less waiting)\n\nYour comfort matters to us.`,
  },
];

const PHARMACY: FaqTemplate[] = [
  {
    category: 'Services',
    businessTypes: ['Pharmacy'],
    question: 'Do I need a prescription for all medications?',
    answer: `No — many medications are available over-the-counter (OTC) without a prescription.\n\nSchedule 5 and above medications (e.g. antibiotics, strong painkillers, chronic meds) require a valid prescription from a registered healthcare provider.\n\nOur pharmacist is happy to advise you.`,
  },
  {
    category: 'Services',
    businessTypes: ['Pharmacy'],
    question: 'Can I collect my chronic medication here?',
    answer: `Yes! We dispense chronic medication for all major medical aids.\n\nFor repeat chronic scripts, we recommend:\n📋 Registering with us for [your medical aid's chronic programme]\n📋 Bringing a [3-month repeat prescription] from your doctor\n\nWe can also arrange [mail order / courier delivery] for chronic medication.`,
  },
  {
    category: 'Services',
    businessTypes: ['Pharmacy'],
    question: 'Do you administer flu vaccines?',
    answer: `Yes! We offer flu vaccines [from [MONTH] each year / year-round].\n\n💉 No appointment needed — walk in during business hours\n💉 Cost: R[AMOUNT] / [covered by most medical aids]\n\nWe also offer [COVID-19 / travel / other] vaccines — ask at the counter.`,
  },
  {
    category: 'Services',
    businessTypes: ['Pharmacy'],
    question: 'Do you offer compounding services?',
    answer: `[Yes! Our compounding pharmacy can prepare customised medications including:\n\n🔬 Topical creams and ointments\n🔬 Customised dosage forms\n🔬 Flavoured medications for children\n\nA valid prescription from your doctor is required. Contact us for turnaround times and pricing.]\n\n[We do not offer in-house compounding but can refer you to a registered compounding pharmacy.]`,
  },
  {
    category: 'Services',
    businessTypes: ['Pharmacy'],
    question: 'Do you offer medication delivery?',
    answer: `[Yes! We offer delivery within [X km] of our pharmacy. Delivery fee: R[AMOUNT]. Prescription items require a valid script to be on file.\n\nOrder before [TIME] for same-day delivery.]\n\n[We currently operate as a walk-in pharmacy only. Contact us to discuss your options.]`,
  },
];

// ── Veterinary & Pets ─────────────────────────────────────────────────────────

const VET: FaqTemplate[] = [
  {
    category: 'Emergencies',
    businessTypes: ['Veterinary Clinic'],
    question: 'Do you handle pet emergencies?',
    answer: `Yes, we do our best to accommodate pet emergencies.\n\n🚨 During hours: Call [PHONE NUMBER] immediately and we'll advise you.\n🚨 After hours: Please contact [AFTER-HOURS EMERGENCY VET at [NUMBER]].\n\nCommon emergencies: difficulty breathing, suspected poisoning, trauma, seizures, inability to urinate.`,
  },
  {
    category: 'Services',
    businessTypes: ['Veterinary Clinic'],
    question: "What is my pet's vaccination schedule?",
    answer: `Vaccination schedules vary by species and age:\n\n🐶 Dogs: [6, 9, 12 weeks] for primary vaccines, then annually\n🐱 Cats: [8, 12 weeks] for primary vaccines, then annually\n🐰 Rabbits: [Ask us for local recommendations]\n\nRabies vaccination is required by law. Bring your pet's health record to every appointment.`,
  },
  {
    category: 'Insurance',
    businessTypes: ['Veterinary Clinic'],
    question: 'Do you accept pet medical aid / pet insurance?',
    answer: `[Yes! We accept claims from major pet insurance providers including [PetSure / MedipetPlus / Oneplan / etc.]. You pay upfront and submit a claim with our itemised invoice.]\n\nWe recommend all pet owners consider pet insurance — vet costs can be significant. Ask us for advice on suitable plans.`,
  },
  {
    category: 'First Visit',
    businessTypes: ['Veterinary Clinic'],
    question: "Should I bring my pet's previous medical records?",
    answer: `Yes, please bring:\n\n📋 Vaccination certificates\n📋 Previous vet records or history\n📋 Any current medications\n📋 Results of any previous tests\n\nThis helps our vet provide the best care and avoid repeating unnecessary tests.`,
  },
  {
    category: 'Services',
    businessTypes: ['Veterinary Clinic'],
    question: 'Do you treat exotic animals?',
    answer: `[Yes! We treat a range of exotic animals including reptiles, birds, rabbits, and small mammals. Please call ahead to confirm we have the appropriate expertise for your pet.]\n\n[We specialise in dogs and cats only. For exotic animals, we recommend [REFERRAL VET NAME] at [CONTACT].]\n\nAlways call before bringing an exotic animal.`,
  },
];

const PET_BOARDING: FaqTemplate[] = [
  {
    category: 'Requirements',
    businessTypes: ['Pet Boarding Facility'],
    question: 'Do you require proof of vaccination for boarding?',
    answer: `Yes! All animals must be up to date on their vaccinations before boarding:\n\n🐶 Dogs: Distemper, Parvovirus, Hepatitis, Rabies, and Kennel Cough\n🐱 Cats: FVRCP, Rabies\n\nPlease bring your pet's vaccination card at drop-off. Pets not current on vaccinations will not be accepted.`,
  },
  {
    category: 'Care',
    businessTypes: ['Pet Boarding Facility'],
    question: "Can I provide my pet's own food and feeding schedule?",
    answer: `Yes! We encourage owners to bring their pet's regular food to avoid digestive upset from a diet change.\n\nPlease provide:\n🥘 Enough food for the stay (labelled with your pet's name)\n📋 Written feeding instructions (times, amounts)\n🍖 Any supplements or special treats`,
  },
  {
    category: 'Care',
    businessTypes: ['Pet Boarding Facility', 'Pet Sitting Service'],
    question: "Can I bring my pet's own bedding and toys?",
    answer: `Absolutely! Familiar items can help your pet feel comfortable and less anxious. Bring:\n\n🛏️ Their favourite bedding or blanket\n🧸 A toy or two\n👕 A worn item of your clothing (your scent is comforting)\n\nPlease label all items with your pet's name.`,
  },
  {
    category: 'Pickup',
    businessTypes: ['Pet Boarding Facility'],
    question: 'What are your drop-off and pick-up times?',
    answer: `Drop-off: [TIME] – [TIME] on weekdays, [TIME] – [TIME] on weekends\nPick-up: [TIME] – [TIME] on weekdays, [TIME] – [TIME] on weekends\n\nLate pick-up (after [TIME]): an additional half-day fee of R[AMOUNT] applies.\n\nPlease let us know in advance if your plans change.`,
  },
  {
    category: 'Updates',
    businessTypes: ['Pet Boarding Facility', 'Pet Sitting Service'],
    question: 'Will I receive updates about my pet while they are staying?',
    answer: `Yes! We send:\n\n📸 Daily photo updates via WhatsApp\n📋 A report on eating, activity, and wellbeing\n\nIf anything concerning arises, we will contact you immediately. Your peace of mind matters as much as your pet's comfort.`,
  },
];

// ── Fitness & Sport ───────────────────────────────────────────────────────────

const GYM: FaqTemplate[] = [
  {
    category: 'Membership',
    businessTypes: ['Gym', 'CrossFit Gym', 'Boxing Gym'],
    question: 'Do you offer month-to-month or contract memberships?',
    answer: `We offer both options:\n\n📅 Month-to-month: R[AMOUNT]/month — cancel anytime with [1 month] notice\n📅 [6-month / 12-month] contract: R[AMOUNT]/month — [X]% saving\n\nNo joining fee on [month-to-month / contract] memberships currently. Ask us about our latest sign-up specials.`,
  },
  {
    category: 'Membership',
    businessTypes: ['Gym'],
    question: 'Can I freeze my gym membership?',
    answer: `Yes! You can freeze your membership for up to [X months] per year.\n\n📋 Notice required: [X days] in advance\n📋 Freeze fee: [R[AMOUNT] / free for [X months]]\n\nTo freeze, message us or speak to front desk. Your membership resumes automatically after the freeze period unless you request otherwise.`,
  },
  {
    category: 'Facilities',
    businessTypes: ['Gym'],
    question: 'Are towels provided at the gym?',
    answer: `[Yes! Clean towels are provided as part of your membership — no need to bring your own.]\n\n[We ask members to bring their own towels. Towels can be hired at reception for R[AMOUNT] per visit.]\n\nWe also provide sanitising spray at all equipment — please wipe down machines before and after use.`,
  },
  {
    category: 'Facilities',
    businessTypes: ['Gym'],
    question: 'Is parking available at the gym?',
    answer: `Yes, [free / paid] parking is available [in our dedicated parking lot / in the shopping centre / on the street].\n\n[X] bays are reserved for gym members during peak hours. A parking disc/sticker is [provided at sign-up / available at reception].`,
  },
];

const YOGA: FaqTemplate[] = [
  {
    category: 'Preparation',
    businessTypes: ['Yoga Studio', 'Pilates Studio'],
    question: 'Do I need to bring my own mat?',
    answer: `[Please bring your own mat — we recommend a non-slip yoga mat for safety and hygiene.]\n\n[We have mats available to borrow/hire for R[AMOUNT] per class — just let us know in advance.]\n\nMat bags and straps can be purchased at reception.`,
  },
  {
    category: 'Preparation',
    businessTypes: ['Yoga Studio', 'Pilates Studio'],
    question: 'What should I wear to class?',
    answer: `Wear comfortable, stretchy clothing that allows full range of movement:\n\n✅ Leggings or shorts\n✅ A fitted top or tank\n✅ Grip socks (for Pilates)\n✅ No shoes required for yoga\n\nAvoid baggy clothing that may fall over your head during inversions!`,
  },
  {
    category: 'Classes',
    businessTypes: ['Yoga Studio', 'Pilates Studio'],
    question: 'Are classes suitable for complete beginners?',
    answer: `Absolutely! We welcome students of all levels.\n\nWe recommend beginners start with:\n🧘 [Beginner / Foundations / Level 1] yoga\n🧘 Hatha or Yin yoga (slower paced)\n\nLet us know it's your first class — the teacher will give modifications and extra guidance.`,
  },
  {
    category: 'Classes',
    businessTypes: ['Yoga Studio'],
    question: 'Do you offer outdoor or beach sessions?',
    answer: `[Yes! We run outdoor sessions at [LOCATION] on [DAYS] at [TIME] — weather permitting. Check our schedule or follow us on Instagram @[HANDLE] for updates.]\n\n[We currently only run indoor studio sessions. Watch our social media for future outdoor events!]`,
  },
];

const SWIMMING_SCHOOL: FaqTemplate[] = [
  {
    category: 'Classes',
    businessTypes: ['Swimming School'],
    question: 'What age groups do you teach?',
    answer: `We offer swimming lessons for all ages:\n\n👶 Parent & infant (6 months – 3 years)\n🧒 Preschool (3–5 years)\n👦 Junior (6–12 years)\n🏊 Teen & adult (13+)\n\nAll levels catered for from complete beginners to competitive swimmers.`,
  },
  {
    category: 'Classes',
    businessTypes: ['Swimming School'],
    question: 'How many learners are in each class?',
    answer: `We keep classes small to ensure quality instruction:\n\n👶 Infant classes: max [6] babies per class\n🧒 Junior classes: max [6–8] learners\n🏊 Adult classes: max [6] students\n\nPrivate lessons are also available for faster progress.`,
  },
  {
    category: 'Parents',
    businessTypes: ['Swimming School'],
    question: 'Can parents watch lessons?',
    answer: `[Yes! Parents are welcome to watch from our designated viewing area.]\n\n[For infant classes, one parent/guardian must be in the water with the child.]\n\n[To minimise distractions, we ask parents to observe quietly from the viewing gallery.]\n\nPhotography/video is [permitted / not permitted] during lessons.`,
  },
  {
    category: 'Preparation',
    businessTypes: ['Swimming School'],
    question: 'What should my child bring to swimming lessons?',
    answer: `Please bring:\n\n🩱 Swimsuit (well-fitting, not baggy boardshorts for lessons)\n🕶️ Goggles\n🧴 Sunscreen (if outdoor pool)\n🛁 Towel and change of clothes\n🎒 Change bag / dry bag\n\nWe provide [kickboards / floats / equipment] during lessons.`,
  },
];

// ── Education & Training ──────────────────────────────────────────────────────

const DRIVING_SCHOOL: FaqTemplate[] = [
  {
    category: 'Licensing',
    businessTypes: ['Driving School'],
    question: "Is learner's licence preparation included in your packages?",
    answer: `Yes! All our packages include:\n\n📚 Learner's licence study material\n📝 Practice tests and mock exams\n🏫 Guidance on the K53 requirements\n\nWe'll help you prepare for both the learner's licence and driving licence tests.`,
  },
  {
    category: 'Lessons',
    businessTypes: ['Driving School'],
    question: 'How many lessons do I need before I can take the driving test?',
    answer: `Most learners are ready after [10–20 lessons] depending on prior experience and learning pace.\n\nWe assess your progress regularly and will advise you when you're ready to book your driving test. We never rush you — safety comes first.`,
  },
  {
    category: 'Lessons',
    businessTypes: ['Driving School'],
    question: 'Do you teach automatic or manual?',
    answer: `We offer lessons in both:\n\n🚗 Manual (stick shift) — recommended for full flexibility\n🚗 Automatic — available for those who prefer it\n\nNote: if you pass your test in an automatic, your licence will be restricted to automatic vehicles. Manual licence allows you to drive both.`,
  },
  {
    category: 'Licensing',
    businessTypes: ['Driving School'],
    question: 'Is the road test included in your packages?',
    answer: `[Yes! Our full package includes the road test booking, examiner fees, and use of our vehicle for the test.]\n\n[Road test fees are charged separately. We assist with booking and provide the vehicle for your test at an additional R[AMOUNT].]\n\nPlease ask about our current packages for full details.`,
  },
];

const TUTORING: FaqTemplate[] = [
  {
    category: 'Services',
    businessTypes: ['Tutoring Centre', 'Homework Centre', 'Exam Preparation Centre'],
    question: 'What subjects do you tutor?',
    answer: `We offer tutoring in:\n\n📚 Mathematics & Physical Science\n📚 English, Afrikaans, and Languages\n📚 Life Sciences and Geography\n📚 Accounting and Business Studies\n📚 [Additional subjects — ask us]\n\nTutoring available from Grade [R/1] through to Matric and university level.`,
  },
  {
    category: 'Format',
    businessTypes: ['Tutoring Centre', 'Homework Centre'],
    question: 'Do you offer individual or group tutoring?',
    answer: `We offer both:\n\n👤 Individual tutoring: personalised pace, direct attention — R[AMOUNT]/hour\n👥 Small group sessions (max [4–6]): more affordable, collaborative — R[AMOUNT]/hour\n\nMany students benefit from a combination of both. Ask us for a recommendation.`,
  },
  {
    category: 'Services',
    businessTypes: ['Tutoring Centre', 'Homework Centre'],
    question: 'Do you help with homework or just exam prep?',
    answer: `We help with both!\n\n📝 Daily homework assistance\n📖 Subject comprehension and concept explanations\n📊 Assignment support\n🎓 Test and exam preparation\n\nWe support students throughout the year, not just during exam time.`,
  },
  {
    category: 'Format',
    businessTypes: ['Tutoring Centre', 'Exam Preparation Centre'],
    question: 'Are online sessions available?',
    answer: `Yes! We offer online tutoring via [Zoom / Google Meet] for students who prefer to learn from home.\n\nOnline sessions are equally effective and include:\n✅ Screen sharing for working through problems\n✅ Digital worksheets and notes\n✅ Recorded sessions (on request)\n\nContact us to set up your online sessions.`,
  },
];

// ── Childcare ─────────────────────────────────────────────────────────────────

const CRECHE: FaqTemplate[] = [
  {
    category: 'Daily Routine',
    businessTypes: ['Crèche', 'Daycare Centre', 'Aftercare Centre'],
    question: 'What should my child bring each day?',
    answer: `Please pack daily:\n\n🎒 Change of clothes (x2)\n🧴 Sunscreen\n💊 Any prescribed medication (with written instructions)\n🍱 Lunch box and water bottle\n🛏️ Comfort item (for naps — labelled)\n\nAll items must be clearly labelled with your child's name.`,
  },
  {
    category: 'Meals',
    businessTypes: ['Crèche', 'Daycare Centre'],
    question: 'Do you provide meals or should I pack lunch?',
    answer: `[We provide a balanced, nutritious meal plan including breakfast, lunch, and an afternoon snack — included in our fees.]\n\n[We ask parents to pack their child's lunch box. We provide morning and afternoon snacks.]\n\nPlease inform us of any allergies or dietary requirements.`,
  },
  {
    category: 'Daily Routine',
    businessTypes: ['Crèche', 'Daycare Centre'],
    question: 'Do you have a nap / rest time policy?',
    answer: `Yes. All children have a scheduled rest/nap time after lunch from [TIME] to [TIME].\n\nYounger children who still nap regularly are accommodated with their own sleep mat/cot. Please let us know your child's routine so we can support them.`,
  },
  {
    category: 'Safety',
    businessTypes: ['Crèche', 'Daycare Centre', 'Aftercare Centre'],
    question: 'Who is authorised to collect my child?',
    answer: `For your child's safety, we only release children to:\n\n✅ Parents/guardians on the registration form\n✅ Other adults listed as authorised on your registration form\n\nAny change to collection arrangements must be communicated in writing (WhatsApp/email) before collection time. Photo ID may be requested.`,
  },
  {
    category: 'Enrolment',
    businessTypes: ['Crèche', 'Daycare Centre'],
    question: 'What documents are needed to register my child?',
    answer: `To register, please provide:\n\n📋 Completed registration form\n📋 Certified copy of child's birth certificate\n📋 Parent/guardian ID copies\n📋 Immunisation record / Road to Health booklet\n📋 Proof of address\n📋 Emergency contact details\n\nContact us to schedule a registration appointment.`,
  },
];

// ── Automotive ────────────────────────────────────────────────────────────────

const MECHANIC: FaqTemplate[] = [
  {
    category: 'Repairs',
    businessTypes: ['Mechanic Workshop', 'Auto Electrician'],
    question: 'Do you provide a quote before starting repairs?',
    answer: `Yes, always. We will:\n\n1️⃣ Diagnose the fault (diagnostic fee: R[AMOUNT])\n2️⃣ Provide a written quote for all parts and labour\n3️⃣ Only proceed with your written or verbal approval\n\nNo surprise charges — ever.`,
  },
  {
    category: 'Repairs',
    businessTypes: ['Mechanic Workshop'],
    question: 'How long does a car service take?',
    answer: `Service times vary:\n\n🔧 Minor service (oil, filters): [1–2 hours]\n🔧 Major service: [3–5 hours]\n🔧 Complex repairs: depends on the job\n\nWe'll give you a time estimate when you drop off your vehicle. We also offer a [courtesy car / shuttle drop-off] — ask us.`,
  },
  {
    category: 'Repairs',
    businessTypes: ['Mechanic Workshop'],
    question: 'Is there a warranty on parts and repairs?',
    answer: `Yes! All our work is covered by:\n\n🔩 Parts warranty: [manufacturer's warranty — typically 12 months / 20 000 km]\n🔧 Labour warranty: [3–6 months] for workmanship\n\nIf any issue arises after your repair, bring the vehicle back and we'll assess it free of charge.`,
  },
  {
    category: 'Logistics',
    businessTypes: ['Mechanic Workshop'],
    question: 'Can you collect and return my vehicle?',
    answer: `[Yes! We offer a collection and delivery service within [X km] for R[AMOUNT].]\n\n[We currently do not offer collection. Please drop your vehicle off at [ADDRESS] between [TIME] and [TIME].]\n\nFor collection, please call us on [PHONE NUMBER] to arrange.`,
  },
];

const CAR_WASH: FaqTemplate[] = [
  {
    category: 'Services',
    businessTypes: ['Car Wash', 'Mobile Car Wash', 'Vehicle Detailing Business'],
    question: 'How long does a car wash take?',
    answer: `Times vary by service:\n\n🚿 Quick rinse & vacuum: [15–20 mins]\n🚗 Full exterior wash: [30–45 mins]\n✨ Full valet (interior + exterior): [1.5–3 hours]\n💎 Full detail: [3–6 hours]\n\nWe'll give you an accurate estimate when you arrive.`,
  },
  {
    category: 'Services',
    businessTypes: ['Car Wash', 'Mobile Car Wash'],
    question: 'Can I wait in the car during the wash?',
    answer: `[For safety reasons, we ask all passengers to exit the vehicle during the wash process. Our comfortable waiting area has seating, WiFi and refreshments.]\n\n[Mobile wash: you're welcome to remain nearby while we work on your vehicle.]`,
  },
  {
    category: 'Services',
    businessTypes: ['Car Wash', 'Vehicle Detailing Business'],
    question: 'Do you wash bakkies, SUVs, and large vehicles?',
    answer: `Yes! We cater for all vehicle types:\n\n🚗 Standard vehicles\n🚙 SUVs and 4x4s\n🛻 Bakkies and double-cabs\n🚌 Minibuses and vans\n\nLarger vehicles may attract a size surcharge. Prices start from R[AMOUNT].`,
  },
];

// ── Home Services ─────────────────────────────────────────────────────────────

const PLUMBING: FaqTemplate[] = [
  {
    category: 'Pricing',
    businessTypes: ['Plumbing'],
    question: 'Do you charge an emergency callout fee after hours?',
    answer: `Yes. Our rates:\n\n⏰ Standard hours ([TIME]–[TIME], Mon–Fri): R[AMOUNT] callout + labour\n🌙 After hours / weekends: R[AMOUNT] callout + R[AMOUNT]/hour\n🚨 Public holidays: R[AMOUNT] callout + R[AMOUNT]/hour\n\nAll rates are quoted upfront before work begins.`,
  },
  {
    category: 'Process',
    businessTypes: ['Plumbing', 'Electrical', 'Handyman'],
    question: 'How does your quote process work?',
    answer: `Our quote process:\n\n1️⃣ Call or message us to describe the problem\n2️⃣ We schedule a site visit (callout fee: R[AMOUNT])\n3️⃣ We assess and provide a written quote\n4️⃣ You approve before we start any work\n\nCallout fee is [deducted from / included in] the final invoice if you proceed with the job.`,
  },
  {
    category: 'Credentials',
    businessTypes: ['Plumbing'],
    question: 'Are your plumbers PIRB registered?',
    answer: `Yes! All our plumbers are registered with the Plumbing Industry Registration Board (PIRB) as required by law in South Africa.\n\nOur PIRB registration number: [NUMBER]\n\nThis ensures our work meets national standards and is legally compliant.`,
  },
  {
    category: 'Services',
    businessTypes: ['Plumbing'],
    question: 'Do you install and repair geysers?',
    answer: `Yes! We handle all geyser work including:\n\n🔧 New geyser installation (solar, electric, heat pump)\n🔧 Geyser repairs and pressure valve replacement\n🔧 Geyser blanket installation\n🔧 Emergency burst geyser replacement\n\nAll geyser installations include a Certificate of Compliance (CoC).`,
  },
  {
    category: 'Emergencies',
    businessTypes: ['Plumbing'],
    question: 'What should I do if I have a burst pipe after hours?',
    answer: `Immediately:\n\n1️⃣ Turn off the main water supply (usually at the meter or street valve)\n2️⃣ Call our emergency line: [PHONE NUMBER]\n3️⃣ Take photos if safe to do so\n\nWe offer 24/7 emergency plumbing — we'll be there as fast as possible.`,
  },
];

const SOLAR: FaqTemplate[] = [
  {
    category: 'Products',
    businessTypes: ['Solar Installation'],
    question: 'Will a solar system keep my power on during load-shedding?',
    answer: `Yes! A solar + battery backup system keeps essential appliances running during load-shedding.\n\nWe offer:\n🔋 Battery backup only (no panels)\n☀️ Solar + battery hybrid (partially offset bill + backup)\n☀️ Full off-grid solution\n\nWe'll assess your energy usage and recommend the right solution.`,
  },
  {
    category: 'Products',
    businessTypes: ['Solar Installation'],
    question: 'What is the difference between grid-tied and off-grid solar?',
    answer: `🔌 Grid-tied: Connected to Eskom. Exports excess power back to the grid. No battery required (though you can add one). Reduced electricity bills.\n\n🏕️ Off-grid: Completely independent of Eskom. Requires sufficient panels + large battery bank. Ideal for farms or areas with poor supply.\n\nMost homes choose a grid-tied + battery hybrid for load-shedding protection and bill savings.`,
  },
  {
    category: 'Compliance',
    businessTypes: ['Solar Installation'],
    question: 'Do you handle Eskom / municipal registration for solar?',
    answer: `Yes! We handle all compliance and registration including:\n\n📋 City Power / municipality small-scale embedded generation (SSEG) application\n📋 Certificate of Compliance (CoC)\n📋 Net metering setup (if applicable)\n\nAll our installations are done by registered electricians.`,
  },
  {
    category: 'Pricing',
    businessTypes: ['Solar Installation'],
    question: 'Do you offer finance options for solar?',
    answer: `Yes! We work with [FINANCE PARTNER] to offer:\n\n💳 Upfront payment + monthly instalments\n🏦 Solar-specific home loans\n📊 Rent-to-own options\n\nIn many cases, monthly savings on your electricity bill can offset your repayment. Contact us for a personalised financial analysis.`,
  },
  {
    category: 'Warranty',
    businessTypes: ['Solar Installation'],
    question: 'What warranty do solar panels come with?',
    answer: `Our panels come with:\n\n☀️ Product warranty: [10–12 years] against defects\n☀️ Performance warranty: [25 years] at [80]% output\n🔋 Inverter warranty: [5–10 years]\n🔋 Battery warranty: [5–10 years] or [X] cycles\n\nWe also offer [X-year] workmanship warranty on our installations.`,
  },
];

const CLEANING: FaqTemplate[] = [
  {
    category: 'Services',
    businessTypes: ['Cleaning'],
    question: 'Do you bring your own cleaning products and equipment?',
    answer: `[Yes! We arrive fully equipped with professional cleaning products, mops, buckets, vacuum, and all tools needed — at no extra charge.]\n\n[We prefer to use your household products if you have preferences. However, we can bring our own for R[AMOUNT] extra.]\n\nPlease let us know when booking.`,
  },
  {
    category: 'Logistics',
    businessTypes: ['Cleaning'],
    question: 'Do I need to be home while you clean?',
    answer: `[No — many of our clients leave a key or access code and we clean while they're at work. All our staff are vetted and we are fully insured.]\n\n[We ask that you or a trusted person is present for the first clean, after which we can arrange access independently.]\n\nYour security and privacy are important to us.`,
  },
  {
    category: 'Billing',
    businessTypes: ['Cleaning'],
    question: 'Can I get a SARS/VAT-compliant invoice?',
    answer: `[Yes! We are VAT registered (VAT No: [NUMBER]) and can provide a fully compliant tax invoice for every service.]\n\n[We are not currently VAT registered. We provide a standard invoice/receipt for all payments.]\n\nInvoices are emailed within [1 business day] of your clean.`,
  },
  {
    category: 'Pricing',
    businessTypes: ['Cleaning'],
    question: 'Is there a discount for recurring cleaning services?',
    answer: `Yes! We reward loyalty:\n\n📅 Weekly cleans: [X]% discount\n📅 Fortnightly cleans: [X]% discount\n📅 Monthly cleans: [X]% discount\n\nRecurring clients are also guaranteed the same cleaner each time, so they get to know your home and preferences.`,
  },
];

// ── Professional Services ─────────────────────────────────────────────────────

const ACCOUNTANT: FaqTemplate[] = [
  {
    category: 'Services',
    businessTypes: ['Accountant', 'Tax Practitioner', 'Bookkeeper'],
    question: 'Do you handle SARS e-filing and tax returns?',
    answer: `Yes! We handle all SARS submissions including:\n\n📊 Individual income tax returns (ITR12)\n📊 Company tax returns (ITR14)\n📊 Provisional tax (IRP6)\n📊 VAT returns (VAT201)\n📊 PAYE reconciliations (EMP501)\n\nWe are registered tax practitioners with SARS.`,
  },
  {
    category: 'Services',
    businessTypes: ['Accountant', 'Tax Practitioner'],
    question: 'Can you assist with VAT registration?',
    answer: `Yes! We assist with:\n\n✅ Compulsory VAT registration (turnover > R1 million)\n✅ Voluntary VAT registration\n✅ VAT deregistration\n✅ Ongoing VAT returns\n\nVAT registration has significant compliance requirements — let us guide you through it correctly.`,
  },
  {
    category: 'Services',
    businessTypes: ['Accountant', 'Bookkeeper'],
    question: 'Do you offer payroll services?',
    answer: `Yes! Our payroll services include:\n\n💰 Monthly payroll processing\n💰 Payslip generation\n💰 PAYE, UIF, and SDL calculations\n💰 EMP201 monthly submissions\n💰 IRP5/IT3a certificates at year-end\n\nPricing from R[AMOUNT]/month depending on number of employees.`,
  },
  {
    category: 'Process',
    businessTypes: ['Accountant', 'Bookkeeper', 'Tax Practitioner'],
    question: 'What is your turnaround time for completing accounts or returns?',
    answer: `Turnaround times (from when we receive all required documents):\n\n📅 Tax returns: [5–10 business days]\n📅 Financial statements: [10–15 business days]\n📅 VAT returns: submitted by SARS deadline\n📅 Monthly bookkeeping: completed within [5] days of month-end\n\nUrgent requests may attract an express fee.`,
  },
  {
    category: 'Software',
    businessTypes: ['Accountant', 'Bookkeeper'],
    question: 'What accounting software do you use?',
    answer: `We work with all major South African accounting platforms:\n\n💻 Xero\n💻 Sage / Pastel\n💻 QuickBooks\n💻 Simple Pay (payroll)\n\nWe can work within your existing system or recommend the best fit for your business size and needs.`,
  },
];

const DEBT_COUNSELLING: FaqTemplate[] = [
  {
    category: 'Process',
    businessTypes: ['Debt Counselling'],
    question: 'Will debt review affect my credit record?',
    answer: `Yes — while under debt review, a flag is placed on your credit record with all credit bureaus. This prevents you from taking on new credit during the process.\n\nOnce you complete the process and receive your clearance certificate, the flag is removed and your credit profile can recover over time.`,
  },
  {
    category: 'Process',
    businessTypes: ['Debt Counselling'],
    question: 'How long does the debt review process take?',
    answer: `The duration depends on your debt level and repayment terms:\n\n⏱️ Most clients complete in [3–5 years]\n⏱️ Once all debts are paid, you receive a Clearance Certificate (Form 19)\n\nWe work with creditors to reduce monthly repayments and interest so you can become debt-free faster.`,
  },
  {
    category: 'Process',
    businessTypes: ['Debt Counselling'],
    question: 'Can I still use my credit cards while under debt review?',
    answer: `No. Once you apply for debt review, all credit accounts are closed to further credit use. This is part of the legal protection the process provides — it prevents further debt accumulation.\n\nYou will be living on a restructured budget designed to cover your essential expenses plus debt repayment.`,
  },
  {
    category: 'Completion',
    businessTypes: ['Debt Counselling'],
    question: 'What is the NDC clearance certificate?',
    answer: `Once all your debts under the debt review plan are settled, your debt counsellor issues a Form 19 (Clearance Certificate).\n\nThis certificate:\n✅ Removes the debt review flag from your credit record\n✅ Confirms you have completed the process\n✅ Allows you to qualify for credit again\n\nKeep this document safely — it is very important.`,
  },
];

// ── Marketing & Technology ────────────────────────────────────────────────────

const WEB_DESIGN: FaqTemplate[] = [
  {
    category: 'Process',
    businessTypes: ['Web Design', 'Software Dev'],
    question: 'How long does it take to build a website?',
    answer: `Timelines vary by project scope:\n\n🖥️ Basic brochure site (5 pages): [2–4 weeks]\n🛒 E-commerce store: [4–8 weeks]\n🏢 Custom web application: [8–16+ weeks]\n\nTimelines depend on how quickly you provide content and feedback. We'll give you a detailed project timeline after our initial consultation.`,
  },
  {
    category: 'Services',
    businessTypes: ['Web Design'],
    question: 'Do you offer website hosting?',
    answer: `Yes! We offer managed hosting packages:\n\n🌐 Shared hosting: R[AMOUNT]/month\n🌐 VPS hosting: R[AMOUNT]/month\n🌐 Managed WordPress: R[AMOUNT]/month\n\nAll hosting includes [daily backups / SSL certificate / uptime monitoring]. Domain registration is available from R[AMOUNT]/year.`,
  },
  {
    category: 'Process',
    businessTypes: ['Web Design'],
    question: 'What information do you need from me to start?',
    answer: `To get started, we typically need:\n\n📋 Business overview and target audience\n📋 Preferred style/design examples\n📋 All text content (or we can write it for you)\n📋 Logo and brand assets\n📋 Photos/images (or we source from stock libraries)\n📋 Domain name and hosting preferences\n\nWe'll guide you through our onboarding checklist step by step.`,
  },
  {
    category: 'Ownership',
    businessTypes: ['Web Design'],
    question: 'Can I update my website myself after it\'s built?',
    answer: `Yes! We build on [WordPress / Webflow / [PLATFORM]] which has an easy-to-use editor so you can update content yourself.\n\nWe also offer:\n✅ Training session on how to manage your site\n✅ Video guides and documentation\n✅ Monthly maintenance packages if you prefer we handle updates`,
  },
  {
    category: 'Services',
    businessTypes: ['Web Design'],
    question: 'Do you build e-commerce stores?',
    answer: `Yes! We build e-commerce stores on [WooCommerce / Shopify / [PLATFORM]].\n\nOur e-commerce packages include:\n🛒 Product catalogue setup\n🛒 Payment gateway integration (PayFast, PayGate, Yoco)\n🛒 Inventory management\n🛒 Order and customer management\n🛒 Mobile-responsive design`,
  },
];

const IT_SUPPORT: FaqTemplate[] = [
  {
    category: 'Service Levels',
    businessTypes: ['IT Support', 'MSP'],
    question: 'What is your SLA response time?',
    answer: `Our SLA response times:\n\n🔴 Critical (system down): [1 hour]\n🟠 High (major function impaired): [2–4 hours]\n🟡 Medium (partial impact): [4–8 business hours]\n🟢 Low (minor issue): [1–2 business days]\n\nAll SLAs are business hours unless you have an after-hours support plan.`,
  },
  {
    category: 'Services',
    businessTypes: ['IT Support', 'MSP'],
    question: 'Do you offer remote and on-site support?',
    answer: `Yes! We offer both:\n\n💻 Remote support: immediate, no travel time, [85%] of issues resolved remotely\n🔧 On-site support: for hardware issues, installations, cabling — [same day / next business day] depending on priority\n\nRemote support is included in all support plans. On-site callout may attract a travel fee.`,
  },
  {
    category: 'Services',
    businessTypes: ['IT Support'],
    question: 'Do you support Mac and Linux systems?',
    answer: `[Yes! We support Windows, Mac, and Linux environments.]\n\n[We primarily support Windows environments. For Mac support, we can assist with basic issues but recommend a Mac specialist for advanced problems.]\n\nPlease mention your operating system when booking so we can send the right technician.`,
  },
  {
    category: 'Services',
    businessTypes: ['IT Support', 'MSP'],
    question: 'Do you offer after-hours support?',
    answer: `[Yes! Our after-hours support is available [24/7 / 7am–10pm] for critical issues under our Premium Support plan.]\n\n[After-hours support is available for critical emergencies at R[AMOUNT]/hour. Standard support is business hours only.]\n\nAsk us about our support plans to find the right fit for your business.`,
  },
];

// ── Events & Creative ─────────────────────────────────────────────────────────

const WEDDING_PHOTOGRAPHER: FaqTemplate[] = [
  {
    category: 'Bookings',
    businessTypes: ['Wedding Photographer', 'Photographer'],
    question: 'How far in advance should I book a wedding photographer?',
    answer: `We recommend booking [9–18 months] in advance for wedding photography, especially for peak season (September–April) and popular dates.\n\nFull payment secures your date. Dates are only confirmed once payment is received.`,
  },
  {
    category: 'Services',
    businessTypes: ['Wedding Photographer'],
    question: 'Do you work with a second shooter?',
    answer: `[Yes! A second photographer is included in our [PACKAGE NAME] and above packages, or can be added to any package for R[AMOUNT].]\n\nA second shooter allows us to capture different angles simultaneously — highly recommended for larger weddings (100+ guests).`,
  },
  {
    category: 'Deliverables',
    businessTypes: ['Wedding Photographer', 'Photographer'],
    question: 'Do we receive digital files and/or prints?',
    answer: `All packages include fully edited high-resolution digital images delivered via [online gallery / USB / download link].\n\nPrint packages, albums, and wall art are available at additional cost. We recommend [ALBUM BRAND] albums — ask us for our print price list.`,
  },
  {
    category: 'Services',
    businessTypes: ['Wedding Photographer'],
    question: 'Is an engagement shoot included?',
    answer: `[Yes! An engagement shoot is included in our [PACKAGE NAME] and above packages.]\n\n[Engagement shoots are available as an add-on for R[AMOUNT]. They're a great way to get comfortable in front of the camera before your wedding day!]`,
  },
  {
    category: 'Deliverables',
    businessTypes: ['Wedding Photographer', 'Photographer', 'Videographer', 'Wedding Planner'],
    question: 'How long does it take to receive the final photos/deliverables?',
    answer: `Turnaround times:\n\n📸 Wedding photos: [6–12 weeks] after the wedding\n📸 Events / portraits: [2–4 weeks]\n🎬 Wedding video: [8–16 weeks]\n\nYou will receive a small selection of sneak-peek images within [48–72 hours] of your wedding.`,
  },
];

const DJ: FaqTemplate[] = [
  {
    category: 'Equipment',
    businessTypes: ['DJ Service', 'Entertainment Agency'],
    question: 'Do you bring your own equipment?',
    answer: `Yes! We arrive fully equipped:\n\n🎵 Professional DJ setup (decks, mixer, laptop)\n🔊 PA speakers (size matched to your venue)\n🎙️ Wireless microphone\n💡 LED lighting and effects\n\nFor large venues or outdoor events, we can upgrade to a larger sound system. Ask us about our technical rider.`,
  },
  {
    category: 'Bookings',
    businessTypes: ['DJ Service'],
    question: 'How far in advance should I book a DJ?',
    answer: `We recommend booking:\n\n👰 Weddings: [6–12 months] in advance\n🎉 Corporate events: [1–3 months] in advance\n🥳 Private parties: [2–4 weeks] in advance\n\nFull payment confirms your booking. Peak season (December, Valentine's, year-end) books up very quickly.`,
  },
  {
    category: 'Bookings',
    businessTypes: ['DJ Service'],
    question: 'Is full payment required and what are your payment terms?',
    answer: `Yes:\n\n💳 Full payment is due at booking to confirm your date\n\nPayment is non-refundable if cancelled within [X days] of the event. We accept PayFast, EFT, card, and SnapScan.`,
  },
  {
    category: 'Logistics',
    businessTypes: ['DJ Service'],
    question: 'Do you travel outside the city? Is there a travel fee?',
    answer: `Yes, we travel to events throughout [PROVINCE/SOUTH AFRICA].\n\nTravel fees:\n🚗 Within [X km] of [CITY]: no travel fee\n🚗 [X]–[X] km: R[AMOUNT]\n🚗 [X]+ km: [R[AMOUNT]/km / accommodation required]\n\nContact us with your venue location for an accurate travel quote.`,
  },
  {
    category: 'Music',
    businessTypes: ['DJ Service'],
    question: 'Can you play specific genres or take song requests?',
    answer: `Absolutely! We cater to your musical tastes.\n\nWe can play:\n🎵 Any genre: Afrobeats, house, hip-hop, R&B, pop, rock, jazz, etc.\n🎵 Custom playlist / do-not-play list\n🎵 Live requests on the night\n🎵 Special songs for first dance, cake cutting, etc.\n\nShare a playlist or your preferences when you book.`,
  },
];

// ── Travel & Logistics ────────────────────────────────────────────────────────

const SHUTTLE: FaqTemplate[] = [
  {
    category: 'Bookings',
    businessTypes: ['Shuttle Service'],
    question: 'How far in advance must I book a shuttle?',
    answer: `We recommend booking:\n\n✈️ Airport transfers: [24–48 hours] in advance\n🏢 Corporate transfers: [1–2 business days] in advance\n🎉 Events: [1 week] in advance\n\nSame-day bookings may be available subject to availability — call us on [PHONE NUMBER].`,
  },
  {
    category: 'Services',
    businessTypes: ['Shuttle Service'],
    question: 'Do you do airport pickups and dropoffs?',
    answer: `Yes! We specialise in airport transfers to/from:\n\n✈️ OR Tambo International\n✈️ Cape Town International\n✈️ King Shaka International\n✈️ [Other airports]\n\nWe monitor flight times and adjust for delays at no extra charge. Meet & greet service available.`,
  },
  {
    category: 'Services',
    businessTypes: ['Shuttle Service'],
    question: 'Do you have baby seats / child seats available?',
    answer: `[Yes! Baby seats and child booster seats are available on request at no extra charge. Please specify the age/weight of your child when booking so we can fit the appropriate seat.]\n\n[We do not currently provide child seats. Clients are welcome to bring their own.]\n\nChild safety is non-negotiable — please always let us know in advance.`,
  },
  {
    category: 'Services',
    businessTypes: ['Shuttle Service'],
    question: 'How much luggage can I bring?',
    answer: `Luggage capacity varies by vehicle:\n\n🚗 Sedan: [2 large suitcases + 2 cabin bags]\n🚙 SUV/MPV: [4 large suitcases + hand luggage]\n🚌 Minibus: [up to X pieces]\n\nFor oversized luggage (golf bags, sports equipment, bicycles), please let us know when booking so we can allocate the right vehicle.`,
  },
  {
    category: 'Corporate',
    businessTypes: ['Shuttle Service'],
    question: 'Do you offer corporate accounts?',
    answer: `Yes! We offer corporate accounts for businesses with regular transfer needs:\n\n✅ Monthly invoicing\n✅ Dedicated account manager\n✅ Priority booking\n✅ Discounted rates for volume\n\nContact us on [EMAIL] to set up your corporate account.`,
  },
];

const MOVING: FaqTemplate[] = [
  {
    category: 'Bookings',
    businessTypes: ['Moving Company'],
    question: 'How far in advance should I book my move?',
    answer: `We recommend booking:\n\n🏠 Local moves: [1–2 weeks] in advance\n🚚 Long-distance / interprovincial: [2–4 weeks] in advance\n📅 Month-end (25th–5th): [4+ weeks] in advance as we get very busy\n\nLast-minute bookings may be possible — call us on [PHONE NUMBER].`,
  },
  {
    category: 'Services',
    businessTypes: ['Moving Company'],
    question: 'Do you offer packing services?',
    answer: `Yes! We offer:\n\n📦 Full packing service (we pack everything)\n📦 Partial packing (fragile/specialist items only)\n📦 Supply of packing materials (boxes, bubble wrap, tape)\n\nProfessional packing reduces the risk of damage and speeds up moving day. Ask for a quote when booking.`,
  },
  {
    category: 'Services',
    businessTypes: ['Moving Company'],
    question: 'Do you offer storage facilities?',
    answer: `[Yes! We offer short and long-term storage in our [secure / climate-controlled] facility at R[AMOUNT]/month for [X] cubic metres.]\n\n[We currently focus on removals only but can recommend trusted storage facilities in your area.]\n\nAsk us when booking if you need storage as part of your move.`,
  },
  {
    category: 'Safety',
    businessTypes: ['Moving Company'],
    question: 'How do you handle fragile and valuable items?',
    answer: `We take extra care with fragile items:\n\n✅ Double-wrapping with bubble wrap and packing paper\n✅ Custom crating for artwork or antiques (ask for a quote)\n✅ Clearly labelled fragile boxes\n✅ Separate handling from heavy items\n\nPlease point out all fragile items to the team leader on moving day.`,
  },
  {
    category: 'Insurance',
    businessTypes: ['Moving Company'],
    question: 'Are my belongings insured during the move?',
    answer: `[Yes! All moves are covered by [in-transit / goods-in-transit] insurance up to R[AMOUNT] at no extra charge.]\n\n[Basic coverage is included. We strongly recommend taking out additional transit insurance for high-value items — we can arrange this for R[AMOUNT].]\n\nA detailed inventory is taken before loading for insurance purposes.`,
  },
];

// ── Retail & Repairs ──────────────────────────────────────────────────────────

const CELLPHONE_REPAIR: FaqTemplate[] = [
  {
    category: 'Services',
    businessTypes: ['Cellphone Repair', 'Computer Repair'],
    question: 'Can you fix water-damaged devices?',
    answer: `Yes! Water damage repair is one of our specialities.\n\n⚠️ If your device got wet: power it off immediately, do NOT charge it, and bring it to us as soon as possible.\n\nSuccess rates depend on how quickly we receive the device and the severity of damage. We offer a [free assessment / R[AMOUNT] assessment] before committing to a repair.`,
  },
  {
    category: 'Services',
    businessTypes: ['Cellphone Repair'],
    question: 'Do you offer same-day repairs?',
    answer: `Yes! Most common repairs are completed same-day:\n\n⚡ Screen replacements: [1–2 hours]\n⚡ Battery replacements: [30–60 mins]\n⚡ Charging port: [1–2 hours]\n\nComplex repairs may take [1–3 business days]. We'll give you a time estimate when you drop off.`,
  },
  {
    category: 'Warranty',
    businessTypes: ['Cellphone Repair', 'Computer Repair'],
    question: 'Do repairs come with a warranty?',
    answer: `Yes! All our repairs are backed by a [3–6 month] warranty covering:\n\n✅ Parts used in the repair\n✅ Our workmanship\n\nThe warranty does not cover physical damage or water damage after the repair. Please handle your device with care!`,
  },
  {
    category: 'Data',
    businessTypes: ['Cellphone Repair', 'Computer Repair'],
    question: 'Can you back up my data before repair?',
    answer: `Yes! We offer a data backup service for R[AMOUNT] before any repair.\n\nWe recommend always backing up your data before any repair. While we take precautions, some repairs (e.g. screen replacements, logic board work) can occasionally result in data loss.\n\nWe are not liable for data loss if you decline a backup.`,
  },
];

const FLOWER_SHOP: FaqTemplate[] = [
  {
    category: 'Orders',
    businessTypes: ['Flower Shop'],
    question: 'Can you create custom flower arrangements?',
    answer: `Yes! We love creating custom arrangements.\n\nFor custom orders, please provide:\n🌸 Occasion (birthday, anniversary, funeral, etc.)\n🌸 Colour preferences\n🌸 Budget\n🌸 Delivery date and address\n\nContact us at least [2–3 days] before needed. For weddings and large events, [2–4 weeks] notice is recommended.`,
  },
  {
    category: 'Delivery',
    businessTypes: ['Flower Shop'],
    question: 'Do you offer same-day flower delivery?',
    answer: `[Yes! Same-day delivery is available for orders placed before [TIME] within [X km] of our shop. Delivery fee: R[AMOUNT].]\n\nOrder via:\n📲 This WhatsApp chat\n🌐 [WEBSITE]\n📞 [PHONE NUMBER]`,
  },
  {
    category: 'Services',
    businessTypes: ['Flower Shop'],
    question: 'Can you send flowers internationally through a wire service?',
    answer: `[Yes! We are a member of [Interflora / Teleflora] and can arrange flower delivery internationally through our network of florists worldwide.]\n\n[We currently deliver locally only. For international orders, we recommend [SERVICE NAME].]\n\nPlease contact us with the destination for availability and pricing.`,
  },
  {
    category: 'Services',
    businessTypes: ['Flower Shop'],
    question: 'Do you do funeral flowers?',
    answer: `Yes, we handle funeral floral arrangements with care and sensitivity:\n\n🕊️ Coffin sprays and wreaths\n🕊️ Standing sprays and crosses\n🕊️ Sympathy bouquets\n🕊️ Condolence arrangements\n\nPlease call us on [PHONE NUMBER] or message us with your requirements and we'll guide you through the process.`,
  },
];

// ── Construction & Renovation ─────────────────────────────────────────────────

const INTERIOR_DESIGN: FaqTemplate[] = [
  {
    category: 'Process',
    businessTypes: ['Interior Design'],
    question: 'Is the initial consultation free?',
    answer: `[Yes! The initial consultation (up to [1 hour]) is complimentary. This allows us to understand your space, style, and budget before committing to a project.]\n\n[Initial consultations are R[AMOUNT] for [1 hour], redeemable against your project fee if you proceed with us.]\n\nContact us to schedule your consultation.`,
  },
  {
    category: 'Process',
    businessTypes: ['Interior Design'],
    question: 'Are 3D renders included in your service?',
    answer: `[Yes! 3D photorealistic renders are included in our full design package so you can visualise your space before any work begins.]\n\n[2D mood boards are included in our standard package. 3D renders are available as an add-on for R[AMOUNT] per room.]\n\nRenders help avoid costly mistakes and ensure you love the result.`,
  },
  {
    category: 'Services',
    businessTypes: ['Interior Design'],
    question: 'Do you manage the renovation project or just design?',
    answer: `We offer both:\n\n📐 Design only: we create the plans, mood boards, and specifications for you to implement\n🏗️ Full project management: we manage contractors, procurement, and delivery end-to-end\n\nFull project management includes regular site visits and ensures your vision is executed correctly.`,
  },
  {
    category: 'Credentials',
    businessTypes: ['Interior Design', 'Architecture', 'Construction Contractor'],
    question: 'Are you registered with the NHBRC?',
    answer: `[Yes! We are registered with the National Home Builders Registration Council (NHBRC). Registration number: [NUMBER].]\n\nNHBRC registration is required by law for new home builds and major renovations. It protects you as the homeowner against defects for [5 years] after completion.`,
  },
];

// ── Specialty Services ────────────────────────────────────────────────────────

const FUNERAL: FaqTemplate[] = [
  {
    category: 'Process',
    businessTypes: ['Funeral Service Provider'],
    question: 'What documents are needed to arrange a funeral?',
    answer: `To arrange a funeral, you will need:\n\n📋 Death certificate (from hospital / Home Affairs / doctor)\n📋 Deceased's ID document\n📋 Next of kin's ID\n📋 Funeral policy documents (if applicable)\n\nWe assist families with all documentation. Contact us on [PHONE NUMBER] — we are available [24/7].`,
  },
  {
    category: 'Services',
    businessTypes: ['Funeral Service Provider'],
    question: 'Do you offer body collection at any time?',
    answer: `Yes. We offer 24-hour body collection services.\n\n📞 Emergency / after-hours: [PHONE NUMBER]\n📞 General enquiries: [PHONE NUMBER]\n\nWe treat every family and loved one with the utmost dignity and respect.`,
  },
  {
    category: 'Services',
    businessTypes: ['Funeral Service Provider'],
    question: 'Can you assist with repatriation of a body from another province or country?',
    answer: `Yes. We handle domestic and international repatriation:\n\n🇿🇦 Within South Africa: road or air transport\n🌍 International: we work with accredited partners worldwide\n\nRepatriation requires specific documentation. Our team will guide you through the process step by step.`,
  },
  {
    category: 'Services',
    businessTypes: ['Funeral Service Provider'],
    question: 'Do you offer catering for after-funeral gatherings?',
    answer: `[Yes! We can arrange catering for your after-tears gathering. Options range from light refreshments to full sit-down meals. Contact us to discuss numbers and preferences.]\n\n[We focus on funeral services but can refer you to trusted catering partners.]\n\nLet us help take the pressure off your family during this difficult time.`,
  },
];

const HOME_NURSING: FaqTemplate[] = [
  {
    category: 'Credentials',
    businessTypes: ['Home Nursing Service', 'Caregiver Agency'],
    question: 'Are your nurses and caregivers SANC-registered?',
    answer: `Yes! All our nurses are registered with the South African Nursing Council (SANC).\n\nOur caregivers are:\n✅ Formally trained and certified\n✅ Background and reference checked\n✅ Regularly supervised and assessed\n✅ First aid certified\n\nYou can verify nurse registrations on the SANC website.`,
  },
  {
    category: 'Safety',
    businessTypes: ['Home Nursing Service', 'Caregiver Agency', 'Elderly Care Service'],
    question: 'Do you perform background checks on all staff?',
    answer: `Yes! All staff undergo:\n\n✅ Criminal background check\n✅ Reference verification (previous employers)\n✅ Identity verification\n✅ Qualification verification\n\nWe take the safety of our clients extremely seriously and would never place unvetted staff in your home.`,
  },
  {
    category: 'Services',
    businessTypes: ['Home Nursing Service', 'Caregiver Agency', 'Elderly Care Service'],
    question: 'Do you offer live-in or day care only?',
    answer: `We offer flexible care options:\n\n🏠 Day care: [X hours/day], [X days/week]\n🌙 Night care: overnight supervision\n🏠 Live-in care: 24/7 resident caregiver\n⏰ Respite care: short-term relief for family caregivers\n\nCare plans are customised to the needs of each client.`,
  },
  {
    category: 'Pricing',
    businessTypes: ['Home Nursing Service', 'Caregiver Agency', 'Elderly Care Service'],
    question: 'What are your care rates?',
    answer: `Our rates:\n\n👩‍⚕️ Registered Nurse: R[AMOUNT]/hour\n👩‍⚕️ Enrolled Nurse: R[AMOUNT]/hour\n👵 Caregiver: R[AMOUNT]/hour\n🏠 Live-in caregiver: R[AMOUNT]/month\n\nRates may vary based on complexity of care required. A care assessment is done before placement.`,
  },
];

// ── All templates combined ────────────────────────────────────────────────────

export const FAQ_TEMPLATES: FaqTemplate[] = [
  ...UNIVERSAL,
  ...RESTAURANT,
  ...BAKERY,
  ...CATERING,
  ...HAIR_SALON,
  ...LASH_STUDIO,
  ...MAKEUP_ARTIST,
  ...WAXING_STUDIO,
  ...AESTHETIC_CLINIC,
  ...MASSAGE,
  ...PHYSIO,
  ...PSYCHOLOGY,
  ...OPTOMETRY,
  ...DENTAL,
  ...PHARMACY,
  ...VET,
  ...PET_BOARDING,
  ...GYM,
  ...YOGA,
  ...SWIMMING_SCHOOL,
  ...DRIVING_SCHOOL,
  ...TUTORING,
  ...CRECHE,
  ...MECHANIC,
  ...CAR_WASH,
  ...PLUMBING,
  ...SOLAR,
  ...CLEANING,
  ...ACCOUNTANT,
  ...DEBT_COUNSELLING,
  ...WEB_DESIGN,
  ...IT_SUPPORT,
  ...WEDDING_PHOTOGRAPHER,
  ...DJ,
  ...SHUTTLE,
  ...MOVING,
  ...CELLPHONE_REPAIR,
  ...FLOWER_SHOP,
  ...INTERIOR_DESIGN,
  ...FUNERAL,
  ...HOME_NURSING,
];

export const FAQ_BUSINESS_TYPES: string[] = [
  // Food & Beverage
  'Restaurant & Café',
  'Coffee Shop',
  'Bakery',
  'Pizzeria',
  'Takeaway Restaurant',
  'Fast Food Outlet',
  'Ghost Kitchen',
  'Food Truck',
  'Catering Company',
  'Meal Prep Service',
  'Private Chef',
  // Hair & Beauty
  'Hair Salon',
  'Barber Shop',
  'Nail Salon',
  'Lash Studio',
  'Brow Studio',
  'Makeup Artist',
  'Waxing Studio',
  'Tanning Salon',
  'Beauty Salon',
  // Aesthetic & Skincare
  'Aesthetic Clinic',
  'Skincare Clinic',
  // Wellness & Spa
  'Massage Parlour',
  'Day Spa',
  'Wellness Centre',
  // Health & Allied Health
  'Physiotherapy',
  'Chiropractic',
  'Biokinetics',
  'Dietitian',
  'Nutritionist',
  'Psychology',
  'Counselling',
  'Occupational Therapy',
  'Speech Therapy',
  'Audiology',
  'Optometry',
  'Podiatry',
  // Medical & Pharmacy
  'General Medical Practice',
  'Dental Practice',
  'Pharmacy',
  // Veterinary & Pets
  'Veterinary Clinic',
  'Pet Grooming Salon',
  'Pet Boarding Facility',
  'Dog Walking Service',
  'Pet Sitting Service',
  // Fitness & Sport
  'Gym',
  'Personal Training Studio',
  'CrossFit Gym',
  'Boxing Gym',
  'Martial Arts School',
  'Yoga Studio',
  'Pilates Studio',
  'Swimming School',
  'Tennis Academy',
  'Golf Academy',
  'Soccer Academy',
  'Dance Studio',
  'Cycling Coaching Business',
  // Education & Training
  'Driving School',
  'Tutoring Centre',
  'Homework Centre',
  'Coding Academy',
  'Music School',
  'Language School',
  'Exam Preparation Centre',
  // Childcare
  'Crèche',
  'Daycare Centre',
  'Aftercare Centre',
  "Children's Activity Centre",
  // Automotive
  'Car Wash',
  'Mobile Car Wash',
  'Vehicle Detailing Business',
  'Mechanic Workshop',
  'Auto Electrician',
  'Tyre Shop',
  'Panel Beating Shop',
  'Windscreen Repair Business',
  'Vehicle Wrapping Business',
  // Home Services
  'Plumbing',
  'Electrical',
  'Gardening',
  'Landscaping',
  'Pest Control',
  'Cleaning',
  'Handyman',
  'Pool Maintenance',
  'Painting',
  'Security Installation',
  'Solar Installation',
  'Air Conditioning',
  'Appliance Repair',
  'Locksmith',
  // Property
  'Estate Agency',
  'Rental Agency',
  'Property Management',
  'Airbnb Management',
  // Professional Services
  'Accountant',
  'Bookkeeper',
  'Tax Practitioner',
  'Financial Advisor',
  'Insurance Broker',
  'Attorney',
  'Notary',
  'Debt Counselling',
  'Business Consultant',
  // Marketing & Technology
  'Marketing Agency',
  'Digital Marketing',
  'Social Media',
  'Graphic Design',
  'Branding',
  'Web Design',
  'Software Dev',
  'IT Support',
  'MSP',
  'Cybersecurity',
  'Recruitment',
  'Staffing',
  'Training',
  // Events & Creative
  'Photographer',
  'Videographer',
  'Wedding Photographer',
  'Wedding Planner',
  'Event Planner',
  'Event Venue',
  'Conference Venue',
  'DJ Service',
  'Entertainment Agency',
  'Party Planning Business',
  // Travel & Logistics
  'Travel Agency',
  'Tour Operator',
  'Shuttle Service',
  'Courier Company',
  'Moving Company',
  'Storage Facility',
  'Laundry Service',
  'Dry Cleaning Business',
  'Tailoring',
  'Alteration',
  // Retail & Repairs
  'Clothing Boutique',
  'Shoe Store',
  'Gift Shop',
  'Furniture Store',
  'Electronics Store',
  'Cellphone Repair',
  'Computer Repair',
  'Vape Shop',
  'Health Shop',
  'Supplement Store',
  'Flower Shop',
  'Jewellery Store',
  'Printing',
  'Signage',
  'Trophy/Engraving',
  'Art Studio',
  'Music Recording Studio',
  'Podcast Studio',
  'Co-working Space',
  'Internet Café',
  // Construction & Renovation
  'Interior Design',
  'Architecture',
  'QS',
  'Construction Contractor',
  'Roofing',
  'Kitchen Installation',
  'Bathroom Renovation',
  'Home Inspection',
  'Borehole',
  'Water Purification',
  // Specialty Services
  'Funeral Service Provider',
  'Mobile Clinic',
  'Community Clinic',
  'Occupational Health Clinic',
  'Blood Testing Laboratory',
  'Home Nursing Service',
  'Caregiver Agency',
  'Elderly Care Service',
];

export const FAQ_CATEGORIES = [
  'All',
  ...Array.from(new Set(FAQ_TEMPLATES.map((t) => t.category))),
];

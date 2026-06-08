export interface FaqTemplate {
  question: string;
  answer: string;
  category: string;
}

export const FAQ_TEMPLATES: FaqTemplate[] = [
  // ── Hours & Location ──────────────────────────────────────────────────────
  {
    category: 'Hours & Location',
    question: 'What are your opening hours?',
    answer: `We're open:\n🗓 Monday – Friday: [e.g. 9:00 AM – 6:00 PM]\n🗓 Saturday: [e.g. 8:00 AM – 5:00 PM]\n🗓 Sunday: [e.g. 10:00 AM – 3:00 PM]\n\nHours may differ on public holidays — message us to confirm.`,
  },
  {
    category: 'Hours & Location',
    question: 'Are you open on weekends?',
    answer: `Yes! We're open on weekends:\n📅 Saturday: [TIME] – [TIME]\n📅 Sunday: [TIME] – [TIME]\n\nWeekend slots fill up fast — book in advance to secure your spot.`,
  },
  {
    category: 'Hours & Location',
    question: 'Are you open on public holidays?',
    answer: `Our public holiday hours vary. We recommend messaging us before your visit to confirm availability. Some holidays we operate on reduced hours ([TIME] – [TIME]).`,
  },
  {
    category: 'Hours & Location',
    question: 'Where are you located?',
    answer: `We're located at [FULL ADDRESS, e.g. 12 Rose Street, Sandton, Johannesburg, 2196].\n\n📍 Landmark: [e.g. Next to the Pick n Pay on Main Road]\n\nNeed directions? Drop us a message and we'll guide you!`,
  },
  {
    category: 'Hours & Location',
    question: 'Is there parking available?',
    answer: `Yes, [FREE/PAID] parking is available [on-site / across the street / in the parking garage on [STREET NAME]].\n\n[Add any extra details, e.g. "There are 10 dedicated bays in front of the salon."]`,
  },
  {
    category: 'Hours & Location',
    question: 'How do I get there by public transport?',
    answer: `We're easily accessible by public transport:\n🚌 Bus: [ROUTE NAME/NUMBER] stops [X] metres from us\n🚇 Taxi: [TAXI RANK NAME] is [X] minutes walk away\n🚂 Train: [STATION NAME] is the closest station\n\nMessage us if you need more specific directions!`,
  },
  {
    category: 'Hours & Location',
    question: 'Do you have multiple locations?',
    answer: `[Currently we only have one location / Yes, we have [NUMBER] locations]:\n📍 [BRANCH 1 NAME]: [ADDRESS]\n📍 [BRANCH 2 NAME]: [ADDRESS]\n\nBookings are location-specific — let us know which branch you'd like!`,
  },
  {
    category: 'Hours & Location',
    question: 'What is your contact number?',
    answer: `You can reach us on:\n📞 [PHONE NUMBER]\n💬 WhatsApp: [WHATSAPP NUMBER]\n📧 Email: [EMAIL ADDRESS]\n\nWe're quickest to respond via WhatsApp during business hours.`,
  },
  {
    category: 'Hours & Location',
    question: 'What is your last booking time?',
    answer: `Our last booking of the day is at [TIME, e.g. 4:00 PM] to ensure we can complete your service before closing.\n\nFor longer services like colour or extensions, please book by [TIME] at the latest.`,
  },
  {
    category: 'Hours & Location',
    question: 'Do you have disabled access?',
    answer: `Yes! Our salon is wheelchair accessible. We have [step-free entrance / ramp at the entrance / accessible bathroom]. If you have any specific needs, please let us know when booking so we can make sure everything is ready for you.`,
  },

  // ── Booking & Appointments ────────────────────────────────────────────────
  {
    category: 'Booking & Appointments',
    question: 'How do I book an appointment?',
    answer: `Booking is easy! You can:\n1️⃣ Reply to this chat and our bot will guide you\n2️⃣ Call us on [PHONE NUMBER]\n3️⃣ Visit us at [ADDRESS] to book in person\n\nWe recommend booking at least [X days/a week] in advance, especially for weekends!`,
  },
  {
    category: 'Booking & Appointments',
    question: 'Do you accept walk-ins?',
    answer: `We do accept walk-ins [when available / on certain days], but we can't always guarantee immediate availability — especially on weekends.\n\nTo avoid waiting, we recommend booking ahead. Reply here or call [PHONE NUMBER] to check same-day availability.`,
  },
  {
    category: 'Booking & Appointments',
    question: 'How far in advance should I book?',
    answer: `We recommend booking at least [X days / 1 week] in advance for most services.\n\n⚡ For special occasions (weddings, matric dances, events): book [X weeks] ahead\n📅 Weekends: book [X days] in advance as slots fill up fast`,
  },
  {
    category: 'Booking & Appointments',
    question: 'Can I cancel or reschedule my appointment?',
    answer: `Yes — life happens! Please give us at least [24 / 48] hours notice so we can offer the slot to someone else.\n\n📲 To cancel or reschedule: reply to this chat or call [PHONE NUMBER]\n\n[Note: Deposits may be [forfeited / transferred] if cancelled with less than [X] hours notice.]`,
  },
  {
    category: 'Booking & Appointments',
    question: 'What is your cancellation policy?',
    answer: `We ask for at least [24 / 48] hours notice for cancellations.\n\n🔴 Late cancellations (less than [X] hours): [deposit is non-refundable / a [R AMOUNT] cancellation fee applies]\n🔴 No-shows: [deposit is forfeited / full service fee may be charged for future bookings]\n\nWe understand emergencies happen — please just let us know as soon as possible.`,
  },
  {
    category: 'Booking & Appointments',
    question: 'What happens if I don\'t show up for my appointment?',
    answer: `Missed appointments affect our team's schedule and other clients who needed that slot.\n\n❌ No-shows: your deposit will be forfeited\n🔄 Repeated no-shows may require full payment upfront for future bookings\n\nIf something comes up, please let us know — we're always happy to reschedule with enough notice.`,
  },
  {
    category: 'Booking & Appointments',
    question: 'What if I\'m running late for my appointment?',
    answer: `Please let us know as soon as possible if you're running late (call or WhatsApp us on [NUMBER]).\n\n⏰ We can usually accommodate up to [15] minutes late.\n⚠️ If you're more than [20] minutes late, we may need to shorten or reschedule your service to be fair to the next client.`,
  },
  {
    category: 'Booking & Appointments',
    question: 'Can I book for someone else?',
    answer: `Absolutely! Just provide us with:\n• Their name\n• Their phone number (for confirmation)\n• The service they'd like\n• Your preferred date and time\n\nAll appointment details will be sent to the number provided.`,
  },
  {
    category: 'Booking & Appointments',
    question: 'Do you take group or party bookings?',
    answer: `Yes, we love group bookings! Whether it's a bridal party, birthday, or girls' day out — we can accommodate groups of [up to X people].\n\n📅 We recommend booking group appointments at least [2–4 weeks] in advance.\n\nFor groups of [X+], please call us directly on [PHONE NUMBER] to discuss arrangements.`,
  },
  {
    category: 'Booking & Appointments',
    question: 'Will I receive a booking confirmation?',
    answer: `Yes! Once your booking is confirmed, you'll receive a confirmation message via WhatsApp with:\n✅ Date and time\n✅ Service booked\n✅ Stylist assigned\n✅ Deposit payment details (if applicable)\n\nWe also send a reminder [24 hours / the day before] your appointment.`,
  },
  {
    category: 'Booking & Appointments',
    question: 'Can I request a specific stylist?',
    answer: `Yes! You're welcome to request a specific stylist when booking. We'll do our best to accommodate you.\n\nPlease note that popular stylists book up quickly — especially on weekends. We recommend booking [X days/weeks] ahead when requesting a specific team member.`,
  },
  {
    category: 'Booking & Appointments',
    question: 'How long will my appointment take?',
    answer: `Service times vary:\n✂️ Haircut: [30–60 minutes]\n🎨 Full colour: [2–3 hours]\n💇 Braids/box braids: [3–6 hours]\n🌊 Weave installation: [2–4 hours]\n💆 Hair treatment: [1–2 hours]\n\nWe'll give you an accurate time estimate when you book based on your specific service and hair type.`,
  },
  {
    category: 'Booking & Appointments',
    question: 'Do you do consultations before booking?',
    answer: `Yes! We offer [free / R[AMOUNT]] consultations for new clients or complex services like colour transformations and hair extensions.\n\nA consultation helps us understand your hair goals and recommend the best treatments. Book a consultation by replying here or calling [PHONE NUMBER].`,
  },

  // ── Services & Pricing ────────────────────────────────────────────────────
  {
    category: 'Services & Pricing',
    question: 'What services do you offer?',
    answer: `We offer a full range of hair services including:\n\n✂️ Cuts & Styling\n🎨 Colour (balayage, ombre, highlights, full colour)\n💇 Braids, twists & locs\n🌊 Weaves & extensions\n💆 Scalp treatments & hair spa\n🔬 Keratin & relaxer treatments\n👰 Bridal & event styling\n\nFor a full menu and prices, reply "SERVICES" or visit [WEBSITE/INSTAGRAM].`,
  },
  {
    category: 'Services & Pricing',
    question: 'How much does a haircut cost?',
    answer: `Our haircut prices start from R[AMOUNT].\n\n✂️ Basic cut & style: R[AMOUNT]\n✂️ Cut, wash & blow-dry: R[AMOUNT]\n✂️ Children's cut (under [AGE]): R[AMOUNT]\n\nPrices may vary depending on hair length, thickness, and complexity. We'll confirm the exact price during your booking.`,
  },
  {
    category: 'Services & Pricing',
    question: 'How much does hair colouring cost?',
    answer: `Colour pricing depends on the type and complexity:\n\n🎨 Single process (root touch-up): from R[AMOUNT]\n🎨 Full head colour: from R[AMOUNT]\n🎨 Highlights (partial): from R[AMOUNT]\n🎨 Highlights (full): from R[AMOUNT]\n🎨 Balayage/ombre: from R[AMOUNT]\n\nA consultation is recommended for colour transformations so we can give you an accurate quote.`,
  },
  {
    category: 'Services & Pricing',
    question: 'Do you do braids?',
    answer: `Yes! We specialise in:\n🔷 Box braids\n🔷 Knotless braids\n🔷 Cornrows\n🔷 Senegalese twists\n🔷 Faux locs\n🔷 Ghana braids\n\nPrices start from R[AMOUNT] and vary based on size, length, and style. Time required: [3–8 hours] depending on the style. Book in advance as braid appointments are very popular!`,
  },
  {
    category: 'Services & Pricing',
    question: 'Do you install weaves and extensions?',
    answer: `Yes! We offer:\n💇 Sew-in weave (weft): from R[AMOUNT]\n💇 Quick weave: from R[AMOUNT]\n💇 Tape-in extensions: from R[AMOUNT]\n💇 Clip-in extensions: from R[AMOUNT]\n\n[Hair/wefts can be supplied by us from R[AMOUNT] or you can bring your own.]\n\nBook a consultation so we can assess your hair and recommend the best method for you.`,
  },
  {
    category: 'Services & Pricing',
    question: 'Do you do locs / dreadlocks?',
    answer: `Yes! We offer:\n🔆 Starter locs: from R[AMOUNT]\n🔆 Loc retwisting: from R[AMOUNT]\n🔆 Loc maintenance & styling: from R[AMOUNT]\n🔆 Faux locs: from R[AMOUNT]\n\nPrices depend on hair length and volume. We'll give you an accurate quote during booking.`,
  },
  {
    category: 'Services & Pricing',
    question: 'Do you do keratin / hair straightening treatments?',
    answer: `Yes! We offer:\n✨ Keratin treatment: from R[AMOUNT]\n✨ Brazilian blowout: from R[AMOUNT]\n✨ Relaxer (new growth): from R[AMOUNT]\n✨ Soft/texturiser: from R[AMOUNT]\n\nThese treatments typically take [2–3 hours]. A patch test may be required for first-time chemical treatments.`,
  },
  {
    category: 'Services & Pricing',
    question: 'Do you do children\'s hair?',
    answer: `Yes, we welcome clients of all ages! 👶\n\n🧒 Children's haircuts (under [12]): from R[AMOUNT]\n👧 Children's braids/styles: from R[AMOUNT]\n\nWe recommend booking during quieter times so your little one feels comfortable. Please note that children must be accompanied by an adult.`,
  },
  {
    category: 'Services & Pricing',
    question: 'Do you do men\'s hair?',
    answer: `Yes! We cater to all genders. Our men's services include:\n\n✂️ Men's cut & style: from R[AMOUNT]\n✂️ Fade / skin fade: from R[AMOUNT]\n✂️ Beard trim: from R[AMOUNT]\n✂️ Cut + beard combo: from R[AMOUNT]\n\nWalk-ins are welcome for men's cuts, but we recommend booking ahead on weekends.`,
  },
  {
    category: 'Services & Pricing',
    question: 'Do you offer scalp treatments?',
    answer: `Yes! Scalp health is the foundation of beautiful hair 🌿\n\n💆 Scalp massage & treatment: from R[AMOUNT]\n💆 Dandruff/dry scalp treatment: from R[AMOUNT]\n💆 Hair loss treatment: from R[AMOUNT]\n💆 Deep conditioning treatment: from R[AMOUNT]\n\nWe use [BRAND NAME] products which are [organic/sulphate-free/dermatologist-approved].`,
  },
  {
    category: 'Services & Pricing',
    question: 'Do you offer bridal hair services?',
    answer: `Yes! We offer full bridal packages 💍\n\n👰 Bridal trial: R[AMOUNT]\n👰 Wedding day styling: from R[AMOUNT]\n👰 Bridal party packages (hair for [X+] people): [PRICING]\n\nWe recommend booking your bridal trial at least [4–6 weeks] before your wedding. Contact us on [NUMBER] to discuss your vision and we'll create something magical!`,
  },
  {
    category: 'Services & Pricing',
    question: 'Do you do ombre and balayage?',
    answer: `Yes! We specialise in colour techniques including:\n\n🎨 Balayage (hand-painted highlights): from R[AMOUNT]\n🎨 Ombre (gradient colour): from R[AMOUNT]\n🎨 Sombre (subtle ombre): from R[AMOUNT]\n🎨 Money piece (face framing highlights): from R[AMOUNT]\n\nA consultation is recommended to discuss your desired result, current hair condition, and to get an accurate quote.`,
  },
  {
    category: 'Services & Pricing',
    question: 'Do you offer hair packages or deals?',
    answer: `Yes! We run regular specials:\n\n📦 [PACKAGE NAME]: [DESCRIPTION] – R[AMOUNT] (save R[AMOUNT])\n📦 [PACKAGE NAME]: [DESCRIPTION] – R[AMOUNT]\n\nFollow us on [INSTAGRAM/FACEBOOK] @[HANDLE] for our latest promotions. Loyalty members also earn [X] stamps per visit!`,
  },
  {
    category: 'Services & Pricing',
    question: 'Do you use professional hair products?',
    answer: `Absolutely — we only use professional, salon-grade products. We work with:\n🌟 [BRAND 1, e.g. L'Oréal Professionnel]\n🌟 [BRAND 2, e.g. Kerastase]\n🌟 [BRAND 3]\n\nAll our products are safe, tested, and gentle on hair. If you have specific product preferences or sensitivities, let us know when booking.`,
  },
  {
    category: 'Services & Pricing',
    question: 'Can I get a price quote before my appointment?',
    answer: `Yes! We're happy to give you an estimate before you commit.\n\n📋 For standard services: prices are listed above\n📋 For complex services (colour, extensions, special styles): reply here with a photo of your hair and what you'd like, and we'll give you an accurate quote.\n\nFinal pricing is confirmed during your appointment after our stylist assesses your hair.`,
  },

  // ── Deposits & Payments ───────────────────────────────────────────────────
  {
    category: 'Deposits & Payments',
    question: 'Do you require a deposit to book?',
    answer: `Yes, we require a booking deposit for most services to secure your appointment.\n\n💳 Deposit amount: R[AMOUNT] / [X]% of the service cost\n\nThe deposit goes toward your total bill on the day. It is [refundable with [X] hours notice / non-refundable for late cancellations or no-shows].\n\nPayment details will be sent with your booking confirmation.`,
  },
  {
    category: 'Deposits & Payments',
    question: 'How do I pay the deposit?',
    answer: `You can pay your deposit via:\n\n🏦 EFT / Bank Transfer: [BANK NAME], Account: [ACCOUNT NUMBER], Reference: [YOUR NAME + DATE]\n📱 SnapScan / Zapper: [Handle]\n💳 Card payment in-salon at time of booking\n\nPlease send proof of payment to [EMAIL / WHATSAPP NUMBER] once paid.`,
  },
  {
    category: 'Deposits & Payments',
    question: 'What payment methods do you accept?',
    answer: `We accept the following payment methods:\n\n💵 Cash\n💳 Credit & Debit card (Visa, Mastercard)\n📱 SnapScan / Zapper\n🏦 EFT / Bank transfer\n[💰 Ozow / Peach Payments]\n\nWe do not currently accept [AMEX / cheques]. Payment is due at time of service.`,
  },
  {
    category: 'Deposits & Payments',
    question: 'Can I get a refund if I\'m not happy with my hair?',
    answer: `Your satisfaction is our priority. If you're unhappy with your service, please let us know [immediately / within [X] days] so we can make it right.\n\n✅ We offer complimentary adjustments if the service wasn't done to spec\n❌ We don't offer cash refunds for services already rendered\n\nPlease don't hesitate to raise any concerns with your stylist or our manager — we want you to leave loving your hair!`,
  },
  {
    category: 'Deposits & Payments',
    question: 'Is a deposit refundable if I cancel?',
    answer: `Our deposit policy:\n\n✅ Full refund: cancel at least [48] hours before your appointment\n⚠️ 50% refund: cancel [24–48] hours before your appointment\n❌ Non-refundable: cancellation with less than [24] hours notice or no-show\n\nDeposits can be transferred to a rescheduled appointment if given sufficient notice.`,
  },
  {
    category: 'Deposits & Payments',
    question: 'Do you offer gift vouchers?',
    answer: `Yes! Our gift vouchers make perfect presents 🎁\n\nAvailable in any amount from R[MINIMUM AMOUNT].\n\nTo purchase:\n📲 Message us on this chat\n📞 Call [PHONE NUMBER]\n🏠 Visit us in-salon\n\nVouchers are valid for [12 months] from date of purchase. They can be redeemed for any service or product.`,
  },
  {
    category: 'Deposits & Payments',
    question: 'Can I pay in instalments?',
    answer: `[We do not currently offer payment plans for services. Full payment is required on the day.]\n\n[Alternatively: We accept [LAYBYE / payment plan] for services above R[AMOUNT]. Chat to us to discuss arrangements.]`,
  },
  {
    category: 'Deposits & Payments',
    question: 'Can I get an invoice for tax purposes?',
    answer: `Yes! We can provide a VAT invoice for any service or product purchase.\n\nPlease let us know at the time of payment that you require an invoice, and provide your:\n• Full name / company name\n• Email address\n• VAT number (if applicable)\n\nInvoices are emailed to you within [1 business day].`,
  },

  // ── Hair Care & Products ──────────────────────────────────────────────────
  {
    category: 'Hair Care & Products',
    question: 'How do I maintain my hair after a treatment?',
    answer: `After your treatment, we recommend:\n\n✅ [SPECIFIC TO SERVICE, e.g. "Wait 72 hours before washing after keratin"]\n✅ Use sulphate-free shampoo and conditioner\n✅ Deep condition once a week\n✅ Avoid excessive heat without heat protectant\n✅ Sleep on a satin/silk pillowcase to reduce breakage\n\nYour stylist will give you personalised aftercare advice during your appointment.`,
  },
  {
    category: 'Hair Care & Products',
    question: 'How do I maintain my colour at home?',
    answer: `To keep your colour vibrant:\n\n🎨 Use colour-safe, sulphate-free shampoo\n🎨 Wash in cool/lukewarm water\n🎨 Deep condition weekly\n🎨 Use a colour-protecting leave-in treatment\n🎨 Minimise heat styling and always use heat protectant\n🎨 Avoid chlorine and saltwater (or protect hair before swimming)\n\nWe sell [BRAND] colour-care products in-salon — ask your stylist for recommendations!`,
  },
  {
    category: 'Hair Care & Products',
    question: 'How often should I come in for a touch-up?',
    answer: `This depends on your service:\n\n🎨 Root colour touch-up: every [4–6 weeks]\n✂️ Haircut trim: every [6–8 weeks]\n🔆 Loc retwist: every [4–6 weeks]\n💇 Weave: [6–8 weeks] before removal\n🧪 Relaxer: every [8–12 weeks]\n\nYour stylist will recommend the best schedule for your specific hair and service.`,
  },
  {
    category: 'Hair Care & Products',
    question: 'Do you sell hair products in the salon?',
    answer: `Yes! We stock a curated range of professional products to help you maintain your hair at home:\n\n🧴 Shampoos & conditioners (from R[AMOUNT])\n🧴 Hair oils & serums (from R[AMOUNT])\n🧴 Styling products (from R[AMOUNT])\n🧴 Heat protectants (from R[AMOUNT])\n\nOur stylists are happy to recommend the right products for your hair type and treatment.`,
  },
  {
    category: 'Hair Care & Products',
    question: 'Do you use heat protectant on my hair?',
    answer: `Yes — protecting your hair is a priority for us. We always apply heat protectant before using any heat tools.\n\nWe use [BRAND NAME] heat protection products. If you have specific product preferences or sensitivities, please let your stylist know.`,
  },
  {
    category: 'Hair Care & Products',
    question: 'Do you do a patch test before chemical treatments?',
    answer: `Yes, for safety we perform a patch test [48 hours] before any chemical service (colour, relaxer, keratin) for:\n\n🔬 New clients having chemical treatments for the first time with us\n🔬 Clients who haven't had a chemical treatment in [12+ months]\n\nPlease visit us [2 days before] your appointment for the patch test. Results must be clear before we proceed.`,
  },
  {
    category: 'Hair Care & Products',
    question: 'Do you use organic or natural products?',
    answer: `[Yes! We are proud to use [BRAND NAME] which is [organic / sulphate-free / paraben-free / vegan-friendly].]\n\n[We offer a range of natural and chemical options to suit your preferences. Just let us know if you'd prefer natural products when booking and we'll accommodate you.]\n\nAll our products are professional-grade and safe for regular use.`,
  },
  {
    category: 'Hair Care & Products',
    question: 'What should I do if I have a bad reaction after a treatment?',
    answer: `If you experience any discomfort, redness, swelling, or irritation after a treatment:\n\n1️⃣ Call us immediately on [PHONE NUMBER]\n2️⃣ If severe, seek medical attention right away\n3️⃣ Do not apply any products to the affected area\n\nWe take all reactions seriously and will advise you on next steps. Your safety is our top priority.`,
  },

  // ── Natural & Protective Styles ───────────────────────────────────────────
  {
    category: 'Natural Hair',
    question: 'Do you cater to natural hair?',
    answer: `Yes — we love natural hair! ✊🏽 Our stylists are experienced with all natural hair types (4A, 4B, 4C and everything in between).\n\nServices for natural hair include:\n🌿 Wash & go\n🌿 Twist out / braid out\n🌿 Protective styles (twists, braids, locs)\n🌿 Natural hair treatments & deep conditioning\n🌿 Big chop consultations\n\nBook a consultation if you'd like personalised advice for your hair journey.`,
  },
  {
    category: 'Natural Hair',
    question: 'Do you do TWAs (teeny weeny afros) or big chops?',
    answer: `Yes! We support every stage of the natural hair journey 🌱\n\nOur stylists are experienced with big chops and TWA styling. We recommend booking a consultation first so we can discuss your goals and the best approach for your hair and face shape.\n\nBig chop / TWA styling: from R[AMOUNT]`,
  },
  {
    category: 'Natural Hair',
    question: 'Do you do crochet braids?',
    answer: `Yes! We offer crochet styles including:\n\n🔷 Crochet braids (various sizes): from R[AMOUNT]\n🔷 Crochet locs: from R[AMOUNT]\n🔷 Crochet twists: from R[AMOUNT]\n🔷 Crochet curly/wavy styles: from R[AMOUNT]\n\nYou can [bring your own hair / we supply the hair from R[AMOUNT]].\nDuration: approximately [2–4 hours].`,
  },
  {
    category: 'Natural Hair',
    question: 'How long do protective styles last?',
    answer: `Longevity depends on the style and how well you maintain it:\n\n🔆 Box braids: [4–8 weeks]\n🔆 Twists: [2–4 weeks]\n🔆 Cornrows: [2–4 weeks]\n🔆 Weave: [6–8 weeks]\n🔆 Crochet braids: [4–6 weeks]\n\nProper maintenance (moisturising scalp, sleeping with a satin bonnet) will extend the life of your style. We recommend coming in for a touch-up when needed.`,
  },

  // ── Policies ──────────────────────────────────────────────────────────────
  {
    category: 'Policies',
    question: 'Can I bring my children to my appointment?',
    answer: `[We welcome children in our salon! We have [a kids' area / toys / TV] to keep them entertained while you relax.]\n\n[For safety reasons, we ask that children are supervised at all times. We cannot guarantee their safety around salon equipment.]\n\n[Children under [AGE] are not permitted in the salon unless they are receiving a service.]`,
  },
  {
    category: 'Policies',
    question: 'Can I bring extra guests to my appointment?',
    answer: `To maintain a calm and comfortable atmosphere for all clients, we ask that you limit additional guests. [One guest is welcome / We prefer no additional guests unless they are also receiving a service.]\n\nIf you need to bring a caregiver or support person, please let us know in advance.`,
  },
  {
    category: 'Policies',
    question: 'What should I wear to my appointment?',
    answer: `We recommend wearing [a top that is easy to take off (button-up or strappy) / dark-coloured clothing] to protect your clothes from product or colour.\n\nWe provide [a protective gown / towels / capes] for all services. Please don't wear anything you'd be upset to get a drop of product on, just in case!`,
  },
  {
    category: 'Policies',
    question: 'Can I eat or drink during my appointment?',
    answer: `You're welcome to drink water or light beverages during your appointment. We [provide complimentary tea, coffee and water / have a small café area].\n\nFor food, we ask that you avoid anything messy during your service. If you have a long appointment (like braids), you're welcome to bring snacks.`,
  },
  {
    category: 'Policies',
    question: 'Do you take photos of clients?',
    answer: `We love sharing our work! We may ask your permission to take before and after photos for our portfolio and social media.\n\n📸 If you'd prefer not to be photographed, just let us know — no problem at all!\n\nWe will never post any photo without your explicit consent. You can follow our work @[INSTAGRAM HANDLE].`,
  },
  {
    category: 'Policies',
    question: 'How do you handle my personal information?',
    answer: `We take your privacy seriously and comply with POPIA (Protection of Personal Information Act).\n\n🔒 Your data is used only for booking and communication purposes\n🔒 We do not sell or share your information with third parties\n🔒 You can request deletion of your data at any time\n\nFor our full privacy policy, [visit [WEBSITE] / contact us at [EMAIL]].`,
  },
  {
    category: 'Policies',
    question: 'How do I make a complaint?',
    answer: `We're sorry to hear if something wasn't up to standard. We take all feedback seriously.\n\n📞 Call us: [PHONE NUMBER]\n📧 Email: [EMAIL ADDRESS]\n💬 WhatsApp: [WHATSAPP NUMBER]\n\nOr ask to speak to [the manager / [MANAGER NAME]] in-salon.\n\nWe aim to resolve all complaints within [24–48 hours] and will do our best to make things right.`,
  },
  {
    category: 'Policies',
    question: 'Do I need to arrive with clean or dry hair?',
    answer: `[You don't need to arrive with clean hair — we'll wash it as part of your service.]\n\n[Please arrive with clean, detangled hair for [SPECIFIC SERVICE, e.g. braids/locs] to save time and ensure the best result.]\n\nIf you're unsure, feel free to ask when booking and we'll advise you!`,
  },

  // ── Staff & Experience ────────────────────────────────────────────────────
  {
    category: 'Staff & Experience',
    question: 'How experienced are your stylists?',
    answer: `Our team is fully qualified and passionate about hair! 💇‍♀️\n\nOur stylists have [X+ years] of combined experience in [areas of expertise, e.g. colour, natural hair, extensions].\n\nAll our stylists are [qualified hairdressers / certified in their specialties] and attend regular training to stay current with the latest techniques and trends.`,
  },
  {
    category: 'Staff & Experience',
    question: 'Who will be doing my hair?',
    answer: `When you book, you can [request a specific stylist / be assigned to the next available stylist].\n\nAll our stylists are equally qualified and will give you excellent results. If you have a preference, just let us know when booking!\n\nMeet our team: [WEBSITE/INSTAGRAM LINK]`,
  },
  {
    category: 'Staff & Experience',
    question: 'Do you have senior and junior stylists?',
    answer: `Yes, we have different experience levels:\n\n⭐ Senior stylists: [X+ years] experience, specialize in [complex colour, extensions, etc.] – from R[AMOUNT]\n⭐ Junior stylists: [X years] experience, supervised and equally skilled – from R[AMOUNT]\n\nAll stylists are trained to our standards. Senior stylists may be preferable for complex transformations.`,
  },
  {
    category: 'Staff & Experience',
    question: 'Do you offer first-time client consultations?',
    answer: `Absolutely! We offer [free / R[AMOUNT]] consultations for new clients.\n\nA consultation lets us:\n✅ Understand your hair goals\n✅ Assess your hair type and condition\n✅ Recommend the best treatments\n✅ Give you an accurate price quote\n\nBook a consultation by replying here or calling [PHONE NUMBER].`,
  },

  // ── Loyalty & Promotions ──────────────────────────────────────────────────
  {
    category: 'Loyalty & Promotions',
    question: 'Do you have a loyalty programme?',
    answer: `Yes! We reward our loyal clients 🌟\n\nHow it works:\n💚 Earn [1 stamp] per qualifying visit\n💚 Collect [X stamps] to earn [a free service / [X]% discount]\n\nYour stamps are tracked automatically — just message this chat anytime to check your balance.\n\nLoyalty rewards cannot be combined with other promotions. T&Cs apply.`,
  },
  {
    category: 'Loyalty & Promotions',
    question: 'How many loyalty stamps do I have?',
    answer: `Reply "STAMPS" or "LOYALTY" to this chat and we'll instantly check your current stamp balance!\n\nYou earn stamps by visiting us for qualifying services. [X stamps = [REWARD DESCRIPTION]].\n\n[You currently have [X] stamps — only [Y] more to go until your next reward! 🎉]`,
  },
  {
    category: 'Loyalty & Promotions',
    question: 'Do you have a referral programme?',
    answer: `Yes! Share the love and get rewarded 🎁\n\n👉 Refer a friend who books and pays for a service\n👉 You both receive [R[AMOUNT] off your next visit / a free [SERVICE]]\n\nJust make sure your friend mentions your name when they book. [Terms and conditions apply.]`,
  },
  {
    category: 'Loyalty & Promotions',
    question: 'Do you offer birthday specials?',
    answer: `Yes! We love celebrating with you 🎂\n\nOn your birthday month, enjoy:\n🎁 [X]% off [any service / specific service]\n🎁 [A complimentary [SERVICE] with any booking]\n\nMake sure you're registered with us and that we have your birthday on file. The special is valid [throughout your birthday month].`,
  },
  {
    category: 'Loyalty & Promotions',
    question: 'Do you offer student discounts?',
    answer: `Yes! Students receive [X]% off [all services / specified services] with a valid student card.\n\nSimply show your student card at your appointment. This discount [can / cannot] be combined with other promotions.\n\n[Valid for [UNIVERSITY/COLLEGE NAME] students only / Valid for all tertiary institution students.]`,
  },
  {
    category: 'Loyalty & Promotions',
    question: 'Do you run seasonal promotions?',
    answer: `Yes! We run regular specials throughout the year — look out for:\n\n🌸 Spring/Summer hair refresh deals\n🎄 Festive season packages\n💕 Valentine's Day specials\n🎓 Back-to-school deals\n\n📲 Follow us @[INSTAGRAM HANDLE] and make sure notifications are on so you never miss a promo!\n\nYou can also reply "SPECIALS" here to see our current offers.`,
  },
  {
    category: 'Loyalty & Promotions',
    question: 'Do you have social media?',
    answer: `Yes! Follow us for hair inspiration, behind-the-scenes content, and our latest promotions:\n\n📸 Instagram: @[HANDLE]\n👍 Facebook: [PAGE NAME]\n🎵 TikTok: @[HANDLE]\n\nWe love seeing our clients' transformations — tag us in your photos using #[HASHTAG]!`,
  },
  {
    category: 'Loyalty & Promotions',
    question: 'Do you offer packages for special events?',
    answer: `Yes! We offer event packages for:\n\n👰 Weddings & bridal parties\n🎓 Matric farewell / prom\n🎉 Birthday parties\n📸 Photo shoots & occasions\n\nPackages include pricing for groups and can be customised. Call us on [PHONE NUMBER] or message us to discuss your event and get a quote.`,
  },

  // ── Health & Safety ───────────────────────────────────────────────────────
  {
    category: 'Health & Safety',
    question: 'How do you maintain hygiene in the salon?',
    answer: `We take cleanliness very seriously:\n\n🧹 All tools (scissors, combs, brushes) are sanitised between every client\n🧹 Capes and towels are washed after every use\n🧹 Workstations are cleaned and disinfected between appointments\n🧹 We use disposable gloves for chemical services\n🧹 Our salon is deep-cleaned [daily / weekly]\n\nYour health and safety is our priority.`,
  },
  {
    category: 'Health & Safety',
    question: 'Can I come in if I have a scalp condition?',
    answer: `It depends on the condition. Some scalp conditions (like seborrheic dermatitis or mild dandruff) we can work with and even treat. Others may require medical clearance first.\n\n⚠️ Please let us know about any scalp conditions when booking\n⚠️ If you have an active scalp infection, we may need to reschedule for your own wellbeing\n\nWe recommend a consultation so we can assess and advise appropriately.`,
  },
  {
    category: 'Health & Safety',
    question: 'Can I have hair services while pregnant?',
    answer: `We recommend consulting your doctor before any chemical treatments (colour, relaxer, keratin) during pregnancy.\n\nWe [do / can] offer:\n✅ Haircuts and styling — completely safe\n✅ Ammonia-free colour options — ask us about safer alternatives\n✅ Deep conditioning and scalp treatments — safe and relaxing\n\nAlways let us know you're pregnant so we can recommend the safest options for you and your baby.`,
  },
  {
    category: 'Health & Safety',
    question: 'I have a sensitive scalp. Can you still help me?',
    answer: `Absolutely! We have experience with sensitive scalps and use gentle, professional products.\n\nPlease let us know when booking so we can:\n✅ Avoid harsh chemicals if needed\n✅ Use fragrance-free or hypoallergenic alternatives\n✅ Perform a patch test before any chemical service\n✅ Adjust application techniques to minimise irritation\n\nYour comfort comes first!`,
  },

  // ── WhatsApp Bot ──────────────────────────────────────────────────────────
  {
    category: 'About Us',
    question: 'Who are you / what is this WhatsApp number?',
    answer: `Hi! This is [SALON NAME]'s official WhatsApp line 💬\n\nWe use this number to:\n📅 Take and manage bookings\n💬 Answer your questions\n🔔 Send appointment reminders\n\nYou're chatting with our assistant — for urgent matters, call us on [PHONE NUMBER] or visit us at [ADDRESS].`,
  },
  {
    category: 'About Us',
    question: 'How long has the salon been open?',
    answer: `[SALON NAME] has been proudly serving our community since [YEAR] — that's [X] years of beautiful transformations! 💇‍♀️✨\n\nWe're [a family-owned business / a small passionate team / an award-winning salon] dedicated to making you feel your best every time you visit.`,
  },
  {
    category: 'About Us',
    question: 'Do you cater to all ethnicities and hair types?',
    answer: `Absolutely! We celebrate all hair types and textures.\n\nOur team is experienced with:\n🌍 African, Afro-Caribbean and natural hair (type 4A–4C)\n🌍 Mixed/biracial hair (type 3A–3C)\n🌍 Straight and fine hair (type 1–2)\n🌍 Thick and coarse hair\n🌍 Hair of all ethnicities\n\nEvery head of hair is unique and deserves expert care!`,
  },
  {
    category: 'About Us',
    question: 'Are you a registered business?',
    answer: `Yes, [SALON NAME] is a fully registered South African business.\n\n📋 Registration number: [REG NUMBER]\n📋 VAT number: [VAT NUMBER if applicable]\n\nWe are compliant with all relevant health, safety, and business regulations.`,
  },

  // ── Quick Replies ─────────────────────────────────────────────────────────
  {
    category: 'Quick Replies',
    question: 'What should I bring to my appointment?',
    answer: `For your appointment, please bring:\n\n✅ Yourself (obviously! 😊)\n✅ [Any hair extensions / wefts if you're supplying your own]\n✅ Inspiration photos (Pinterest/Instagram screenshots work great)\n✅ Proof of deposit payment (if applicable)\n\nWear comfortable clothes as some services take a few hours. We'll take care of the rest!`,
  },
  {
    category: 'Quick Replies',
    question: 'I don\'t know what hairstyle I want — can you help?',
    answer: `Of course! That's what we're here for 🌟\n\nWe offer [free / R[AMOUNT]] consultations where our stylists can:\n✅ Assess your hair type, texture, and condition\n✅ Understand your lifestyle and maintenance preferences\n✅ Recommend styles that suit your face shape\n✅ Show you inspiration from our portfolio\n\nBook a consultation by replying here or calling [PHONE NUMBER].`,
  },
  {
    category: 'Quick Replies',
    question: 'How can I see examples of your work?',
    answer: `You can see our work on:\n\n📸 Instagram: @[HANDLE] — our most up-to-date portfolio\n👍 Facebook: [PAGE NAME]\n🖼️ Website gallery: [WEBSITE URL]\n\nWe post before & afters, new styles, and client transformations regularly. Feel free to save any styles you love and bring them as inspiration to your appointment!`,
  },
  {
    category: 'Quick Replies',
    question: 'Is there a waiting area?',
    answer: `Yes! We have a comfortable waiting area with [seating / WiFi / magazines / TV / refreshments].\n\nWe do our best to keep to schedule, but sometimes services run over. We'll always let you know if there's a wait. ☕`,
  },
  {
    category: 'Quick Replies',
    question: 'Do you offer home visits?',
    answer: `[Yes! We offer mobile/home services for [elderly / bridal / special occasion] clients. Travel fee: R[AMOUNT] within [X km]. Please call us on [PHONE NUMBER] to discuss.]\n\n[We currently only operate from our salon at [ADDRESS]. We hope to offer mobile services in the future!]`,
  },
  {
    category: 'Quick Replies',
    question: 'Can you help me with hair loss?',
    answer: `We offer treatments that support scalp health and hair growth:\n\n💆 Scalp analysis & consultation: R[AMOUNT]\n💆 Scalp stimulation treatments: from R[AMOUNT]\n💆 [PRP / low-level laser / etc. if applicable]\n\nHowever, for significant hair loss we recommend also seeing a dermatologist or trichologist. We can work alongside medical treatment to support your journey.\n\nBook a consultation with us to discuss your concerns.`,
  },
  {
    category: 'Quick Replies',
    question: 'Do you work with extensions for added length or volume?',
    answer: `Yes! We specialise in natural-looking extensions for length and volume:\n\n💇 Clip-in extensions: from R[AMOUNT] (for the look / day)\n💇 Tape-in extensions: from R[AMOUNT] (lasts 6–8 weeks)\n💇 Sew-in weft: from R[AMOUNT]\n💇 Micro-bead extensions: from R[AMOUNT]\n\n[We source high-quality human hair extensions / remy hair] in a range of colours and textures to match your natural hair perfectly.`,
  },
];

export const FAQ_CATEGORIES = [
  'All',
  ...Array.from(new Set(FAQ_TEMPLATES.map((t) => t.category))),
];

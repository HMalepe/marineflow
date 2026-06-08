export interface ServiceTemplate {
  businessType: string;
  category: string;
  name: string;
  description: string;
  suggestedPriceRands: number;
  suggestedDurationMin: number;
}

export const SERVICE_BUSINESS_TYPES = [
  'Hair Salon',
  'Barber Shop',
  'Nail Bar',
  'Waxing & Threading',
  'Massage & Spa',
  'Skincare & Facials',
  'Lash & Brow Bar',
  'Restaurant & Café',
  'Tattoo & Piercing',
  'Beauty Boutique',
  'Shop / Retail',
];

export const SERVICE_TEMPLATES: ServiceTemplate[] = [

  // ── HAIR SALON — MALE ──────────────────────────────────────────────────────

  { businessType: 'Barber Shop', category: 'Male Cuts', name: 'Low Fade', description: 'Clean low fade with sharp line-up. Hair gradually fades from skin near the ears and neck, blending smoothly upward.', suggestedPriceRands: 120, suggestedDurationMin: 30 },
  { businessType: 'Barber Shop', category: 'Male Cuts', name: 'Mid Fade', description: 'Mid fade with a crisp line-up. The fade starts midway up the head for a bold, defined look.', suggestedPriceRands: 130, suggestedDurationMin: 30 },
  { businessType: 'Barber Shop', category: 'Male Cuts', name: 'High Fade', description: 'High fade cutting close to the skin high on the sides, leaving more hair on top. Includes edge-up.', suggestedPriceRands: 140, suggestedDurationMin: 35 },
  { businessType: 'Barber Shop', category: 'Male Cuts', name: 'Skin / Bald Fade', description: 'Razor-sharp skin fade blended to nothing. The ultimate clean finish. Includes neck shave.', suggestedPriceRands: 150, suggestedDurationMin: 40 },
  { businessType: 'Barber Shop', category: 'Male Cuts', name: 'High Top Fade', description: 'Classic 90s-inspired high top with clean sides. Top left flat or rounded per preference.', suggestedPriceRands: 160, suggestedDurationMin: 45 },
  { businessType: 'Barber Shop', category: 'Male Cuts', name: 'Chiskop / Clean Shave', description: 'Full head shave with clippers and razor for a smooth, clean finish. Includes hot towel.', suggestedPriceRands: 100, suggestedDurationMin: 25 },
  { businessType: 'Barber Shop', category: 'Male Cuts', name: 'Line-Up / Edge-Up Only', description: 'Crisp edge-up along the hairline, forehead, and around the ears. No cut — just the shape-up.', suggestedPriceRands: 60, suggestedDurationMin: 15 },
  { businessType: 'Barber Shop', category: 'Male Cuts', name: 'Mohawk / Fohawk', description: 'Shaved or faded sides with a defined strip of hair on top. Styled upright or swept forward.', suggestedPriceRands: 160, suggestedDurationMin: 40 },
  { businessType: 'Barber Shop', category: 'Male Cuts', name: 'Afro Trim & Shape', description: 'Natural afro trimmed and shaped to a perfect round or angular silhouette using an afro comb and clippers.', suggestedPriceRands: 110, suggestedDurationMin: 30 },
  { businessType: 'Barber Shop', category: 'Male Cuts', name: 'Taper Cut', description: 'Gradual taper from longer on top to shorter on the sides and back. Neat and professional.', suggestedPriceRands: 130, suggestedDurationMin: 35 },
  { businessType: 'Barber Shop', category: 'Male Cuts', name: 'Caesar Cut', description: 'Short, even-length cut with a horizontally straight fringe. Clean, timeless style.', suggestedPriceRands: 120, suggestedDurationMin: 30 },
  { businessType: 'Barber Shop', category: 'Male Cuts', name: 'Waves Cut & Prep', description: 'Short cut followed by brushing and wave grease application to train 360 or 540 waves.', suggestedPriceRands: 140, suggestedDurationMin: 40 },
  { businessType: 'Barber Shop', category: 'Male Cuts', name: 'Buzz Cut', description: 'All-over uniform cut with clippers at a single guard length. Fast, clean, and low maintenance.', suggestedPriceRands: 90, suggestedDurationMin: 20 },
  { businessType: 'Barber Shop', category: 'Male Cuts', name: 'Undercut', description: 'Sides and back cut very short while the top is left long. Can be styled slicked back or messy.', suggestedPriceRands: 150, suggestedDurationMin: 40 },
  { businessType: 'Barber Shop', category: 'Male Cuts', name: 'Comb Over Fade', description: 'Hair combed to one side over a clean fade. Smart, polished style for work or formal occasions.', suggestedPriceRands: 150, suggestedDurationMin: 40 },

  // Beard
  { businessType: 'Barber Shop', category: 'Beard Services', name: 'Beard Shave & Fade Combo', description: 'Full haircut and beard fade combined. Includes hot towel, razor shave on the neckline, and beard oil finish.', suggestedPriceRands: 200, suggestedDurationMin: 55 },
  { businessType: 'Barber Shop', category: 'Beard Services', name: 'Beard Shape & Trim Only', description: 'Beard trimmed, shaped, and defined with straight razor edges. Includes hot towel and beard balm.', suggestedPriceRands: 80, suggestedDurationMin: 20 },
  { businessType: 'Barber Shop', category: 'Beard Services', name: 'Full Beard Shave (Straight Razor)', description: 'Traditional wet shave with hot towel, shaving cream, and straight razor. Includes aftershave and beard oil.', suggestedPriceRands: 120, suggestedDurationMin: 30 },
  { businessType: 'Barber Shop', category: 'Beard Services', name: 'Beard Colour / Tint', description: 'Beard dyed to match hair colour or blend grey. Natural or fashion shades available.', suggestedPriceRands: 150, suggestedDurationMin: 30 },
  { businessType: 'Barber Shop', category: 'Beard Services', name: 'Line-Up + Beard Combo', description: 'Edge-up on the hairline plus beard shape and razor detailing. No scissor cut.', suggestedPriceRands: 120, suggestedDurationMin: 30 },

  // Male Dreadlocks
  { businessType: 'Hair Salon', category: 'Male Dreadlocks', name: 'Dreadlocks Start (New Locs)', description: 'New dreadlocks created from natural hair using the twist, interlocking, or comb coil method. Price varies with hair length.', suggestedPriceRands: 400, suggestedDurationMin: 180 },
  { businessType: 'Hair Salon', category: 'Male Dreadlocks', name: 'Dreadlock Retwist', description: 'Roots retightened and reshaped to keep locs neat and growing in the right direction.', suggestedPriceRands: 250, suggestedDurationMin: 90 },
  { businessType: 'Hair Salon', category: 'Male Dreadlocks', name: 'Dreadlock Retwist + Wash', description: 'Hair washed with clarifying shampoo, dried, and roots retwisted. Leaves locs fresh and clean.', suggestedPriceRands: 320, suggestedDurationMin: 120 },
  { businessType: 'Hair Salon', category: 'Male Dreadlocks', name: 'Loc Extensions (Short)', description: 'Human or synthetic hair added to short natural locs to create instant length and fullness.', suggestedPriceRands: 600, suggestedDurationMin: 240 },

  // Male Cornrows
  { businessType: 'Hair Salon', category: 'Male Braids', name: 'Cornrows (Straight Back)', description: 'Classic straight back cornrows from the front hairline to the nape. Neat and clean rows.', suggestedPriceRands: 150, suggestedDurationMin: 60 },
  { businessType: 'Hair Salon', category: 'Male Braids', name: 'Cornrows (Design / Pattern)', description: 'Custom patterned cornrows — zig-zag, curved, or freestyle design. Price depends on complexity.', suggestedPriceRands: 250, suggestedDurationMin: 90 },
  { businessType: 'Hair Salon', category: 'Male Braids', name: 'Man Bun / Updo Braids', description: 'Cornrows or flat twists braided into an updo/man bun style. Includes edge slick-down.', suggestedPriceRands: 200, suggestedDurationMin: 75 },

  // ── HAIR SALON — FEMALE ────────────────────────────────────────────────────

  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Box Braids (Small)', description: 'Small box braids using kanekalon or human hair. Individual boxes parted and braided to desired length. Long-lasting protective style.', suggestedPriceRands: 700, suggestedDurationMin: 360 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Box Braids (Medium)', description: 'Medium-sized box braids — the most popular size. Full head using kanekalon hair. Neat partings throughout.', suggestedPriceRands: 550, suggestedDurationMin: 270 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Box Braids (Large/Jumbo)', description: 'Big, bold jumbo box braids. Done faster than smaller sizes. Great for a statement look.', suggestedPriceRands: 400, suggestedDurationMin: 180 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Knotless Box Braids', description: 'Feed-in method with no knot at the root — less tension, more natural-looking base. Very gentle on edges.', suggestedPriceRands: 750, suggestedDurationMin: 360 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Straight Back Braids', description: 'Neat straight-back cornrows from hairline to nape. Classic, clean, and professional look.', suggestedPriceRands: 180, suggestedDurationMin: 60 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Cornrows (Full Head)', description: 'Full head cornrows in a chosen pattern — straight, curved, or tribal design. Add-on synthetic hair optional.', suggestedPriceRands: 300, suggestedDurationMin: 120 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Feed-In Ponytail', description: 'Cornrows braided towards the back and secured into a high or low ponytail extension. Sleek and long-lasting.', suggestedPriceRands: 350, suggestedDurationMin: 120 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Senegalese Twists', description: 'Two-strand twists using silky or kinky kanekalon hair. Lightweight and elegant protective style.', suggestedPriceRands: 600, suggestedDurationMin: 300 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Passion Twists', description: 'Boho-style twists using passion water-wave hair for a defined, springy, natural-looking twist.', suggestedPriceRands: 650, suggestedDurationMin: 300 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Butterfly / Bohemian Braids', description: 'Knotless box braids with loose, curly hair peeking through for a wispy, effortless boho look.', suggestedPriceRands: 900, suggestedDurationMin: 420 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Fulani Braids', description: 'Inspired by the Fulani people — features a centre cornrow, side braids, and decorative beads or rings.', suggestedPriceRands: 500, suggestedDurationMin: 240 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Micro Braids', description: 'Very fine individual braids for an intricate, detailed look. Time-intensive but incredibly versatile.', suggestedPriceRands: 900, suggestedDurationMin: 480 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Twist Out Set', description: 'Natural hair twisted while damp and unravelled once dry for defined, coily curls. No extensions used.', suggestedPriceRands: 200, suggestedDurationMin: 60 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Flat Twists (Full Head)', description: 'Flat twists lying against the scalp in a chosen design. Can be worn as-is or unravelled for a twist-out.', suggestedPriceRands: 250, suggestedDurationMin: 90 },

  // Female Dreadlocks
  { businessType: 'Hair Salon', category: 'Dreadlocks', name: 'Soft Dreads / Crochet Dreads', description: 'Soft, light pre-made dread extensions crocheted onto natural hair. No chemicals. Removable style.', suggestedPriceRands: 500, suggestedDurationMin: 240 },
  { businessType: 'Hair Salon', category: 'Dreadlocks', name: 'Faux Locs (Short)', description: 'Individual faux loc extensions to shoulder length. Natural-looking locs without the long-term commitment.', suggestedPriceRands: 550, suggestedDurationMin: 300 },
  { businessType: 'Hair Salon', category: 'Dreadlocks', name: 'Faux Locs (Long)', description: 'Long faux loc extensions past shoulder — waist length available. Includes beeswax or mousse finish.', suggestedPriceRands: 750, suggestedDurationMin: 420 },
  { businessType: 'Hair Salon', category: 'Dreadlocks', name: 'Goddess Locs', description: 'Faux locs with curly ends for a goddess/boho look. Often includes loose curls or waves peeking through.', suggestedPriceRands: 750, suggestedDurationMin: 360 },
  { businessType: 'Hair Salon', category: 'Dreadlocks', name: 'New Locs (Start / Install)', description: 'Create brand new dreadlocks from natural hair using palm rolling, interlocking, or comb coils.', suggestedPriceRands: 500, suggestedDurationMin: 240 },
  { businessType: 'Hair Salon', category: 'Dreadlocks', name: 'Loc Retwist', description: 'New growth at roots retightened to maintain neat, defined locs. Includes light moisturising.', suggestedPriceRands: 280, suggestedDurationMin: 90 },
  { businessType: 'Hair Salon', category: 'Dreadlocks', name: 'Loc Retwist + Style', description: 'Roots retwisted then locs styled into an updo, ponytail, or down style of choice.', suggestedPriceRands: 380, suggestedDurationMin: 120 },

  // Weaves & Wigs
  { businessType: 'Hair Salon', category: 'Weaves & Wigs', name: 'Weave (Sew-In)', description: 'Natural hair cornrowed flat, then weft hair extensions sewn in with a needle and thread. Includes closure or leave-out.', suggestedPriceRands: 600, suggestedDurationMin: 180 },
  { businessType: 'Hair Salon', category: 'Weaves & Wigs', name: 'Quick Weave (Half Head)', description: 'Synthetic or human hair bonded onto a protective cap. Half head with leave-out top section.', suggestedPriceRands: 300, suggestedDurationMin: 90 },
  { businessType: 'Hair Salon', category: 'Weaves & Wigs', name: 'Full Lace Wig Install', description: 'Full lace or HD lace wig installed with adhesive, gel bands, or wig clips. Includes hairline customisation and blending.', suggestedPriceRands: 500, suggestedDurationMin: 120 },
  { businessType: 'Hair Salon', category: 'Weaves & Wigs', name: 'Lace Front Wig Install', description: 'Lace front wig glued or sewn down with a natural-looking hairline. Includes plucking and baby hair lay.', suggestedPriceRands: 400, suggestedDurationMin: 90 },
  { businessType: 'Hair Salon', category: 'Weaves & Wigs', name: 'Wig Customisation & Style', description: 'Existing wig plucked, bleached, cut, and styled to your face. Bring your own wig.', suggestedPriceRands: 350, suggestedDurationMin: 90 },
  { businessType: 'Hair Salon', category: 'Weaves & Wigs', name: 'Closure Sew-In', description: 'Sew-in weave with a 4×4 or 5×5 lace closure on top for a seamless, scalp-like finish. No leave-out needed.', suggestedPriceRands: 700, suggestedDurationMin: 210 },
  { businessType: 'Hair Salon', category: 'Weaves & Wigs', name: 'Frontal Sew-In', description: '13×4 or 13×6 frontal installed with a full sew-in for maximum coverage and a versatile hairline.', suggestedPriceRands: 900, suggestedDurationMin: 240 },

  // Natural Hair
  { businessType: 'Hair Salon', category: 'Natural Hair', name: 'Wash & Go', description: 'Shampoo, deep conditioner, and leave-in applied to define natural curl pattern. Air or diffuser dry.', suggestedPriceRands: 200, suggestedDurationMin: 75 },
  { businessType: 'Hair Salon', category: 'Natural Hair', name: 'Wash, Condition & Blow Dry', description: 'Full shampoo, deep condition, and blow dry straight or stretched. Includes light trim if needed.', suggestedPriceRands: 250, suggestedDurationMin: 90 },
  { businessType: 'Hair Salon', category: 'Natural Hair', name: 'Flat Iron / Press & Curl', description: 'Natural hair blow dried and flat ironed bone straight or curled with a curling iron. Heat protectant applied.', suggestedPriceRands: 300, suggestedDurationMin: 90 },
  { businessType: 'Hair Salon', category: 'Natural Hair', name: 'Bantu Knots', description: 'Hair sectioned and wound into small spiral knots sitting flat against the scalp. Can be unravelled for a knot-out.', suggestedPriceRands: 200, suggestedDurationMin: 60 },
  { businessType: 'Hair Salon', category: 'Natural Hair', name: 'Perm Rods / Flexi Rods Set', description: 'Natural or stretched hair wound onto perm or flexi rods for defined spiral curls. Dried under hood dryer.', suggestedPriceRands: 250, suggestedDurationMin: 120 },
  { businessType: 'Hair Salon', category: 'Natural Hair', name: 'Deep Conditioning Treatment', description: 'Protein or moisture deep conditioner applied, capped, and processed under steam or hood dryer for 20–30 min.', suggestedPriceRands: 150, suggestedDurationMin: 45 },
  { businessType: 'Hair Salon', category: 'Natural Hair', name: 'Scalp Treatment', description: 'Medicated or nourishing scalp treatment for dryness, dandruff, itchiness, or hair loss. Includes massage.', suggestedPriceRands: 200, suggestedDurationMin: 45 },
  { businessType: 'Hair Salon', category: 'Natural Hair', name: 'Hair Steaming', description: 'Steam machine used to open the hair cuticle and allow deep penetration of oils and conditioners.', suggestedPriceRands: 120, suggestedDurationMin: 30 },
  { businessType: 'Hair Salon', category: 'Natural Hair', name: 'Trim & Reshape', description: 'Split ends removed and shape trimmed to promote healthy growth. Includes blowout stretch.', suggestedPriceRands: 150, suggestedDurationMin: 45 },

  // Relaxed / Treated Hair
  { businessType: 'Hair Salon', category: 'Relaxed Hair', name: 'Relaxer (New Growth / Touch-Up)', description: 'Lye or no-lye relaxer applied to new growth only. Includes neutralising shampoo, conditioning treatment, and blowout.', suggestedPriceRands: 350, suggestedDurationMin: 120 },
  { businessType: 'Hair Salon', category: 'Relaxed Hair', name: 'Relaxer (Virgin / Full Head)', description: 'First-time relaxer on all-natural hair. Patch test required. Includes full treatment and blowout.', suggestedPriceRands: 450, suggestedDurationMin: 150 },
  { businessType: 'Hair Salon', category: 'Relaxed Hair', name: 'Wash & Set / Roller Set', description: 'Shampooed, conditioned, set on rollers, and dried under a hood dryer for classic bouncy curls.', suggestedPriceRands: 220, suggestedDurationMin: 90 },
  { businessType: 'Hair Salon', category: 'Relaxed Hair', name: 'Wash & Blowout', description: 'Shampoo, deep condition, blow dry straight. Foundation for any finish style.', suggestedPriceRands: 200, suggestedDurationMin: 60 },

  // Hair Colour
  { businessType: 'Hair Salon', category: 'Colour Services', name: 'Single Colour (Full Head)', description: 'All-over colour application with permanent or semi-permanent dye. Includes developer and conditioning rinse.', suggestedPriceRands: 450, suggestedDurationMin: 120 },
  { businessType: 'Hair Salon', category: 'Colour Services', name: 'Highlights (Half Head)', description: 'Foil highlights placed on top section and crown. Brightens the overall look without full commitment.', suggestedPriceRands: 500, suggestedDurationMin: 120 },
  { businessType: 'Hair Salon', category: 'Colour Services', name: 'Highlights (Full Head)', description: 'Full head foil highlights for a dramatically lighter, multi-toned result. Includes toner.', suggestedPriceRands: 750, suggestedDurationMin: 180 },
  { businessType: 'Hair Salon', category: 'Colour Services', name: 'Balayage', description: 'Hand-painted highlights for a seamless, natural grow-out. Softer than foils — looks sun-kissed.', suggestedPriceRands: 900, suggestedDurationMin: 180 },
  { businessType: 'Hair Salon', category: 'Colour Services', name: 'Ombré / Dip Dye', description: 'Colour transition from darker roots to lighter or coloured ends. Bold and low-maintenance.', suggestedPriceRands: 700, suggestedDurationMin: 150 },
  { businessType: 'Hair Salon', category: 'Colour Services', name: 'Toner / Gloss', description: 'Toner applied after lightening to neutralise brassy tones or add shine and vibrancy.', suggestedPriceRands: 250, suggestedDurationMin: 45 },
  { businessType: 'Hair Salon', category: 'Colour Services', name: 'Colour Correction', description: 'Multi-step colour correction for uneven tones, over-processed, or previously dyed hair. Priced per consultation.', suggestedPriceRands: 1200, suggestedDurationMin: 300 },
  { businessType: 'Hair Salon', category: 'Colour Services', name: 'Root Touch-Up', description: 'Colour applied to regrowth/roots only to match existing colour. Quick and affordable maintenance.', suggestedPriceRands: 300, suggestedDurationMin: 75 },

  // ── CHILDREN'S SERVICES ────────────────────────────────────────────────────

  { businessType: 'Hair Salon', category: "Children's Hair", name: "Kids Haircut (Boy, Under 10)", description: "Clean haircut for boys under 10. Includes clippers and/or scissors, with a lollipop for the brave ones 🍭", suggestedPriceRands: 80, suggestedDurationMin: 20 },
  { businessType: 'Barber Shop', category: "Children's Hair", name: "Kids Fade (Under 10)", description: "Gentle fade for young boys. Low or mid fade with a neat line-up. Patient and child-friendly service.", suggestedPriceRands: 90, suggestedDurationMin: 25 },
  { businessType: 'Hair Salon', category: "Children's Hair", name: "Baby's First Haircut", description: "A milestone! First haircut for babies and toddlers. Certificate and photo available. Gentle and unhurried.", suggestedPriceRands: 100, suggestedDurationMin: 30 },
  { businessType: 'Hair Salon', category: "Children's Hair", name: "Kids Natural Hair Wash & Style", description: "Gentle shampoo, detangle, condition, and style for natural-haired girls. Protective style options available.", suggestedPriceRands: 150, suggestedDurationMin: 60 },
  { businessType: 'Hair Salon', category: "Children's Hair", name: "Kids Cornrows (Short Hair)", description: "Neat cornrows for children with short to medium hair. Fun designs available on request.", suggestedPriceRands: 120, suggestedDurationMin: 45 },
  { businessType: 'Hair Salon', category: "Children's Hair", name: "Kids Box Braids", description: "Medium box braids for children using lightweight kanekalon hair. Gentle on the scalp and tender-headed kids.", suggestedPriceRands: 350, suggestedDurationMin: 180 },
  { businessType: 'Hair Salon', category: "Children's Hair", name: "Kids Soft Dreads", description: "Lightweight crochet dreads for kids. No chemicals. Lasts 6–8 weeks.", suggestedPriceRands: 300, suggestedDurationMin: 150 },
  { businessType: 'Hair Salon', category: "Children's Hair", name: "Kids Wash & Blowout", description: "Gentle shampoo, detangle, condition, and blowout for relaxed or natural children's hair.", suggestedPriceRands: 120, suggestedDurationMin: 45 },
  { businessType: 'Hair Salon', category: "Children's Hair", name: "Teen Haircut & Style (Girl)", description: "Full haircut and style for teenage girls. Includes trim, blowout, and finish.", suggestedPriceRands: 200, suggestedDurationMin: 60 },
  { businessType: 'Barber Shop', category: "Children's Hair", name: "Teen Fade (13–17)", description: "Teen boy's fade haircut. Low, mid, or high — includes edge-up and light styling product.", suggestedPriceRands: 110, suggestedDurationMin: 30 },

  // ── NAIL BAR ───────────────────────────────────────────────────────────────

  { businessType: 'Nail Bar', category: 'Manicure', name: 'Basic Manicure', description: 'Nails soaked, cuticles pushed back, nails shaped, buffed, and finished with regular nail polish of your choice.', suggestedPriceRands: 120, suggestedDurationMin: 45 },
  { businessType: 'Nail Bar', category: 'Manicure', name: 'Gel Manicure', description: 'Nails shaped and finished with gel polish cured under UV/LED lamp. Lasts 2–3 weeks without chipping.', suggestedPriceRands: 200, suggestedDurationMin: 60 },
  { businessType: 'Nail Bar', category: 'Manicure', name: 'Gel Removal + Manicure', description: 'Safe gel removal by soaking in acetone, followed by a fresh basic manicure. No damage to natural nails.', suggestedPriceRands: 180, suggestedDurationMin: 60 },
  { businessType: 'Nail Bar', category: 'Manicure', name: 'French Manicure', description: 'Classic white tip with pink or nude base. Available in regular or gel. Timeless and elegant.', suggestedPriceRands: 220, suggestedDurationMin: 60 },
  { businessType: 'Nail Bar', category: 'Manicure', name: 'SNS / Dip Powder Manicure', description: 'Nails dipped in coloured powder for a durable, odour-free finish. No UV lamp needed. Lasts 3–4 weeks.', suggestedPriceRands: 250, suggestedDurationMin: 75 },
  { businessType: 'Nail Bar', category: 'Manicure', name: 'Chrome / Mirror Nails', description: 'Gel manicure finished with chrome powder for a stunning metallic mirror effect. Very Insta-worthy ✨', suggestedPriceRands: 280, suggestedDurationMin: 75 },
  { businessType: 'Nail Bar', category: 'Manicure', name: 'Nail Art (per nail)', description: 'Custom hand-painted or stamped nail art on one or more nails. Flowers, gems, abstract, French, etc.', suggestedPriceRands: 20, suggestedDurationMin: 10 },
  { businessType: 'Nail Bar', category: 'Manicure', name: 'Nail Art (Full Set)', description: 'Full set of 10 nails with custom nail art design. Gems, foil, marble, gradient, or your own design idea.', suggestedPriceRands: 350, suggestedDurationMin: 90 },
  { businessType: 'Nail Bar', category: 'Manicure', name: 'Luxury Spa Manicure', description: 'Includes soak, exfoliation scrub, hot towel, mask, extended massage, cuticle treatment, and gel polish.', suggestedPriceRands: 350, suggestedDurationMin: 90 },

  // Pedicure
  { businessType: 'Nail Bar', category: 'Pedicure', name: 'Basic Pedicure', description: 'Feet soaked, nails trimmed and filed, calluses buffed, cuticles done, and regular polish applied. Includes foot rub.', suggestedPriceRands: 150, suggestedDurationMin: 60 },
  { businessType: 'Nail Bar', category: 'Pedicure', name: 'Gel Pedicure', description: 'Full pedicure treatment finished with gel polish for a long-lasting chip-free colour.', suggestedPriceRands: 250, suggestedDurationMin: 75 },
  { businessType: 'Nail Bar', category: 'Pedicure', name: 'Luxury Spa Pedicure', description: 'Foot soak, callus removal, exfoliation, mask, hot towel wrap, extended massage, cuticle treatment, and gel polish.', suggestedPriceRands: 380, suggestedDurationMin: 90 },
  { businessType: 'Nail Bar', category: 'Pedicure', name: 'Callus Removal Treatment', description: 'Specialist treatment to remove thick, hard skin and calluses on heels and ball of foot. Includes foot soak.', suggestedPriceRands: 200, suggestedDurationMin: 45 },
  { businessType: 'Nail Bar', category: 'Pedicure', name: 'Mani-Pedi Combo (Gel)', description: 'Full gel manicure and gel pedicure together. Save time and money with the combo price.', suggestedPriceRands: 420, suggestedDurationMin: 120 },

  // Nail Extensions
  { businessType: 'Nail Bar', category: 'Nail Extensions', name: 'Acrylic Full Set', description: 'Full set of acrylic nail extensions — choose length and shape (square, coffin, almond, round). Includes colour.', suggestedPriceRands: 350, suggestedDurationMin: 90 },
  { businessType: 'Nail Bar', category: 'Nail Extensions', name: 'Acrylic Infill / Fill', description: 'Regrowth filled in on existing acrylic set. Includes reshape and colour change.', suggestedPriceRands: 250, suggestedDurationMin: 60 },
  { businessType: 'Nail Bar', category: 'Nail Extensions', name: 'Gel Extensions (Hard Gel)', description: 'Natural-looking gel extensions applied with forms or tips. Lighter than acrylic with a glossy finish.', suggestedPriceRands: 400, suggestedDurationMin: 90 },
  { businessType: 'Nail Bar', category: 'Nail Extensions', name: 'Builder Gel (BIAB)', description: 'Builder In A Bottle — strengthens and extends natural nails. Perfect for nail-biters. No forms needed.', suggestedPriceRands: 300, suggestedDurationMin: 75 },
  { businessType: 'Nail Bar', category: 'Nail Extensions', name: 'Nail Extension Removal', description: 'Safe acrylic or gel extension removal by soaking. Includes nail treatment to restore natural nail health.', suggestedPriceRands: 120, suggestedDurationMin: 45 },
  { businessType: 'Nail Bar', category: 'Nail Extensions', name: 'Ombre / Baby Boomer Extensions', description: 'Acrylic or gel extensions with a gradient ombre or baby boomer (pink-to-white) fade. Very popular style.', suggestedPriceRands: 500, suggestedDurationMin: 120 },
  { businessType: 'Nail Bar', category: 'Nail Extensions', name: 'Nail Repair (per nail)', description: 'Single broken or lifted nail repaired. Patch, acrylic, or gel fix to restore the full set.', suggestedPriceRands: 40, suggestedDurationMin: 15 },

  // Kids Nails
  { businessType: 'Nail Bar', category: "Children's Nails", name: "Kids Manicure (Under 12)", description: "Mini manicure for children — nails filed, buffed, and finished with child-safe polish. Fun colours and glitter available!", suggestedPriceRands: 80, suggestedDurationMin: 30 },
  { businessType: 'Nail Bar', category: "Children's Nails", name: "Kids Pedicure (Under 12)", description: "Mini pedicure with foot soak, nail trim, and child-friendly nail polish. A special treat for little ones.", suggestedPriceRands: 100, suggestedDurationMin: 35 },

  // ── WAXING & THREADING ─────────────────────────────────────────────────────

  { businessType: 'Waxing & Threading', category: 'Face', name: 'Eyebrow Wax', description: 'Unwanted hair removed above, below, and between brows with warm wax for a clean, defined shape.', suggestedPriceRands: 80, suggestedDurationMin: 15 },
  { businessType: 'Waxing & Threading', category: 'Face', name: 'Eyebrow Threading', description: 'Traditional threading technique for precise brow shaping. Great for sensitive skin. No chemicals.', suggestedPriceRands: 70, suggestedDurationMin: 15 },
  { businessType: 'Waxing & Threading', category: 'Face', name: 'Eyebrow Wax + Tint', description: 'Brows waxed to shape then tinted to match hair colour or desired shade. Includes 15-min development time.', suggestedPriceRands: 160, suggestedDurationMin: 30 },
  { businessType: 'Waxing & Threading', category: 'Face', name: 'Upper Lip Wax', description: 'Quick and effective upper lip hair removal using warm wax. Minimal discomfort.', suggestedPriceRands: 60, suggestedDurationMin: 10 },
  { businessType: 'Waxing & Threading', category: 'Face', name: 'Upper Lip Threading', description: 'Upper lip hair removed precisely with thread. Great for very fine hair. Lasts 4–6 weeks.', suggestedPriceRands: 50, suggestedDurationMin: 10 },
  { businessType: 'Waxing & Threading', category: 'Face', name: 'Full Face Wax', description: 'Chin, upper lip, cheeks, and forehead waxed for a completely smooth complexion.', suggestedPriceRands: 180, suggestedDurationMin: 30 },
  { businessType: 'Waxing & Threading', category: 'Face', name: 'Full Face Threading', description: 'All facial areas threaded including brows, upper lip, chin, and sideburns. Precise and gentle.', suggestedPriceRands: 200, suggestedDurationMin: 40 },
  { businessType: 'Waxing & Threading', category: 'Face', name: 'Chin Wax', description: 'Chin and lower jaw hair removal using warm wax. Quick and clean.', suggestedPriceRands: 70, suggestedDurationMin: 10 },
  { businessType: 'Waxing & Threading', category: 'Face', name: 'Sideburns / Cheek Wax', description: 'Hair on cheeks and sideburn area removed. Often paired with eyebrow wax.', suggestedPriceRands: 70, suggestedDurationMin: 10 },

  // Body waxing
  { businessType: 'Waxing & Threading', category: 'Body', name: 'Underarm Wax', description: 'Both underarms waxed smooth. Lasts 3–4 weeks. Reduces hair regrowth over time.', suggestedPriceRands: 100, suggestedDurationMin: 15 },
  { businessType: 'Waxing & Threading', category: 'Body', name: 'Half Leg Wax', description: 'Legs waxed from knee to ankle. Includes calves and front/back lower legs.', suggestedPriceRands: 200, suggestedDurationMin: 30 },
  { businessType: 'Waxing & Threading', category: 'Body', name: 'Full Leg Wax', description: 'Full leg wax from ankle to upper thigh. Includes both front and back.', suggestedPriceRands: 350, suggestedDurationMin: 60 },
  { businessType: 'Waxing & Threading', category: 'Body', name: 'Arm Wax (Half)', description: 'Forearms waxed from wrist to elbow. Smooth skin for 4–6 weeks.', suggestedPriceRands: 150, suggestedDurationMin: 25 },
  { businessType: 'Waxing & Threading', category: 'Body', name: 'Arm Wax (Full)', description: 'Both arms waxed from wrist to shoulder.', suggestedPriceRands: 250, suggestedDurationMin: 40 },
  { businessType: 'Waxing & Threading', category: 'Body', name: 'Bikini Wax (Regular)', description: 'Hair removed along the bikini line — anything outside the underwear area. Quick and clean.', suggestedPriceRands: 150, suggestedDurationMin: 20 },
  { businessType: 'Waxing & Threading', category: 'Body', name: 'Brazilian Wax', description: 'Full front, back, and between removed. A small strip or full removal — your choice.', suggestedPriceRands: 280, suggestedDurationMin: 40 },
  { businessType: 'Waxing & Threading', category: 'Body', name: 'Hollywood Wax', description: 'Complete removal of all intimate hair front and back. Total smoothness.', suggestedPriceRands: 320, suggestedDurationMin: 45 },
  { businessType: 'Waxing & Threading', category: 'Body', name: 'Back Wax (Male)', description: "Full back waxed smooth. Popular for men before summer or formal occasions.", suggestedPriceRands: 300, suggestedDurationMin: 45 },
  { businessType: 'Waxing & Threading', category: 'Body', name: 'Chest Wax (Male)', description: "Full chest and stomach waxed. Includes the happy trail. Clean and confident look.", suggestedPriceRands: 280, suggestedDurationMin: 40 },
  { businessType: 'Waxing & Threading', category: 'Body', name: 'Stomach / Abdomen Wax', description: 'Lower stomach and navel area waxed. Often done alongside bikini or Brazilian.', suggestedPriceRands: 100, suggestedDurationMin: 15 },

  // ── MASSAGE & SPA ──────────────────────────────────────────────────────────

  { businessType: 'Massage & Spa', category: 'Massage', name: 'Swedish Massage (30 min)', description: 'Light-to-medium pressure full body massage using long, flowing strokes to relax muscles and improve circulation.', suggestedPriceRands: 250, suggestedDurationMin: 30 },
  { businessType: 'Massage & Spa', category: 'Massage', name: 'Swedish Massage (60 min)', description: 'Full hour Swedish massage. Our most popular relaxation treatment. The perfect stress-relief reset.', suggestedPriceRands: 450, suggestedDurationMin: 60 },
  { businessType: 'Massage & Spa', category: 'Massage', name: 'Swedish Massage (90 min)', description: 'Extended Swedish massage for a deeply relaxing, head-to-toe experience. Includes full back, legs, and arms.', suggestedPriceRands: 620, suggestedDurationMin: 90 },
  { businessType: 'Massage & Spa', category: 'Massage', name: 'Deep Tissue Massage (60 min)', description: 'Firm pressure targeting deep muscle layers to release chronic tension, knots, and postural tightness.', suggestedPriceRands: 550, suggestedDurationMin: 60 },
  { businessType: 'Massage & Spa', category: 'Massage', name: 'Hot Stone Massage (60 min)', description: 'Heated basalt stones placed on key points and used as massage tools. Deeply warming and therapeutic.', suggestedPriceRands: 650, suggestedDurationMin: 60 },
  { businessType: 'Massage & Spa', category: 'Massage', name: 'Aromatherapy Massage (60 min)', description: 'Gentle massage with a custom blend of essential oils chosen for your mood and needs — relax, energise, or balance.', suggestedPriceRands: 550, suggestedDurationMin: 60 },
  { businessType: 'Massage & Spa', category: 'Massage', name: 'Sports / Remedial Massage', description: 'Targeted treatment for athletes or active people. Focuses on injury prevention, recovery, and muscle performance.', suggestedPriceRands: 600, suggestedDurationMin: 60 },
  { businessType: 'Massage & Spa', category: 'Massage', name: 'Prenatal / Pregnancy Massage', description: 'Gentle massage designed for expectant mothers. Side-lying position with bolsters for comfort and safety.', suggestedPriceRands: 500, suggestedDurationMin: 60 },
  { businessType: 'Massage & Spa', category: 'Massage', name: 'Couples Massage (60 min)', description: 'Two people massaged simultaneously in the same room. Perfect for date night or a special occasion.', suggestedPriceRands: 900, suggestedDurationMin: 60 },
  { businessType: 'Massage & Spa', category: 'Massage', name: 'Back & Shoulder Massage (30 min)', description: 'Focused 30-minute massage on the back, shoulders, and neck — the classic stress zones.', suggestedPriceRands: 280, suggestedDurationMin: 30 },
  { businessType: 'Massage & Spa', category: 'Massage', name: 'Foot & Reflexology Massage (45 min)', description: 'Pressure applied to reflex points on the feet that correspond to organs and body systems. Deeply relaxing.', suggestedPriceRands: 350, suggestedDurationMin: 45 },
  { businessType: 'Massage & Spa', category: 'Massage', name: 'Head, Neck & Shoulder Massage (30 min)', description: 'Indian head massage technique targeting tension in scalp, neck, and shoulders. Can be done seated and clothed.', suggestedPriceRands: 250, suggestedDurationMin: 30 },
  { businessType: 'Massage & Spa', category: 'Massage', name: 'CBD Oil Massage (60 min)', description: 'Swedish or deep tissue massage using CBD-infused oil for enhanced muscle relaxation and anti-inflammatory benefits.', suggestedPriceRands: 700, suggestedDurationMin: 60 },

  // Spa Packages
  { businessType: 'Massage & Spa', category: 'Spa Packages', name: 'Half Day Spa Package', description: 'Includes 60 min Swedish massage, full body scrub, facial, and herbal tea lounge. The ultimate recharge.', suggestedPriceRands: 1500, suggestedDurationMin: 210 },
  { businessType: 'Massage & Spa', category: 'Spa Packages', name: 'Full Body Scrub', description: 'Full body exfoliation using salt or sugar scrub to slough dead skin. Leaves you glowing and smooth. Shower included.', suggestedPriceRands: 400, suggestedDurationMin: 45 },
  { businessType: 'Massage & Spa', category: 'Spa Packages', name: 'Body Wrap Treatment', description: 'Detox, hydrating, or slimming wrap applied to the body, wrapped in bandages or foil, and left to penetrate for 30 min.', suggestedPriceRands: 600, suggestedDurationMin: 75 },
  { businessType: 'Massage & Spa', category: 'Spa Packages', name: 'Romantic Couples Spa Package', description: 'Private room, rose petals, champagne, couples massage, and body scrub. Memorable and luxurious.', suggestedPriceRands: 2500, suggestedDurationMin: 180 },

  // ── SKINCARE & FACIALS ─────────────────────────────────────────────────────

  { businessType: 'Skincare & Facials', category: 'Facials', name: 'Express Facial (30 min)', description: 'Quick cleanse, tone, and moisturise. Great for a lunchtime refresh or before an event.', suggestedPriceRands: 200, suggestedDurationMin: 30 },
  { businessType: 'Skincare & Facials', category: 'Facials', name: 'Classic Facial (60 min)', description: 'Deep cleanse, steam, extractions, mask, tone, and moisturise. The foundation of a good skincare routine.', suggestedPriceRands: 380, suggestedDurationMin: 60 },
  { businessType: 'Skincare & Facials', category: 'Facials', name: 'Anti-Aging Facial', description: 'Targets fine lines, wrinkles, and loss of elasticity. Includes collagen or peptide mask and facial massage.', suggestedPriceRands: 500, suggestedDurationMin: 75 },
  { businessType: 'Skincare & Facials', category: 'Facials', name: 'Acne / Blemish Control Facial', description: 'Thorough cleanse, BHA exfoliation, targeted extractions, and calming mask for congested, breakout-prone skin.', suggestedPriceRands: 450, suggestedDurationMin: 75 },
  { businessType: 'Skincare & Facials', category: 'Facials', name: 'Brightening / Glow Facial', description: 'Vitamin C serum, AHA peel, and brightening mask to fade pigmentation and even skin tone. SA melanin-safe formula.', suggestedPriceRands: 500, suggestedDurationMin: 75 },
  { businessType: 'Skincare & Facials', category: 'Facials', name: 'Hydrating / Moisture Boost Facial', description: 'Hyaluronic acid, hydrating mask, and lipid-rich moisturiser for dehydrated, dull, or dry skin.', suggestedPriceRands: 420, suggestedDurationMin: 60 },
  { businessType: 'Skincare & Facials', category: 'Facials', name: 'Men\'s Facial', description: 'Cleanse, exfoliation, extractions, and mattifying mask tailored for thicker, oilier male skin. Includes brow tidy.', suggestedPriceRands: 380, suggestedDurationMin: 60 },
  { businessType: 'Skincare & Facials', category: 'Facials', name: 'Teen / Teen Acne Facial', description: 'Gentle but effective facial for teen skin — controls oil, unclogs pores, and teaches a basic skincare routine.', suggestedPriceRands: 280, suggestedDurationMin: 45 },
  { businessType: 'Skincare & Facials', category: 'Advanced Treatments', name: 'Microdermabrasion', description: 'Crystal or diamond-tip exfoliation to resurface the skin and improve texture, pigmentation, and fine lines.', suggestedPriceRands: 600, suggestedDurationMin: 60 },
  { businessType: 'Skincare & Facials', category: 'Advanced Treatments', name: 'Chemical Peel (Light)', description: 'AHA or BHA light peel to exfoliate dead cells and stimulate renewal. Minimal downtime. 3–6 sessions recommended.', suggestedPriceRands: 550, suggestedDurationMin: 45 },
  { businessType: 'Skincare & Facials', category: 'Advanced Treatments', name: 'LED Light Therapy Facial', description: 'LED panel used post-facial to treat acne (blue light), ageing (red light), or inflammation. Non-invasive and painless.', suggestedPriceRands: 350, suggestedDurationMin: 30 },
  { businessType: 'Skincare & Facials', category: 'Advanced Treatments', name: 'Microneedling (Face)', description: 'Tiny needles create micro-channels to stimulate collagen production. Treats scars, pigmentation, and fine lines.', suggestedPriceRands: 900, suggestedDurationMin: 60 },
  { businessType: 'Skincare & Facials', category: 'Advanced Treatments', name: 'HydraFacial', description: 'Medical-grade multi-step treatment: cleanse, exfoliate, extract, and hydrate with serums. Instantly glowing skin.', suggestedPriceRands: 1200, suggestedDurationMin: 60 },
  { businessType: 'Skincare & Facials', category: 'Advanced Treatments', name: 'Carbon Laser Peel', description: 'Carbon cream applied, then a laser pulsed to vaporise it — exfoliates, shrinks pores, and reduces pigmentation.', suggestedPriceRands: 1500, suggestedDurationMin: 60 },

  // ── LASH & BROW BAR ────────────────────────────────────────────────────────

  { businessType: 'Lash & Brow Bar', category: 'Lash Extensions', name: 'Classic Lash Extensions', description: 'One synthetic or mink lash applied to each natural lash. Natural, defined look. Lasts 3–4 weeks with fills.', suggestedPriceRands: 600, suggestedDurationMin: 90 },
  { businessType: 'Lash & Brow Bar', category: 'Lash Extensions', name: 'Volume Lash Extensions', description: 'Multiple lightweight lashes fanned onto each natural lash for dramatic fullness. 3D to 7D effect.', suggestedPriceRands: 750, suggestedDurationMin: 120 },
  { businessType: 'Lash & Brow Bar', category: 'Lash Extensions', name: 'Mega Volume Lash Extensions', description: 'Maximum fullness and drama with ultra-fine lash fans. For clients who love an ultra-glam, full lash.', suggestedPriceRands: 900, suggestedDurationMin: 150 },
  { businessType: 'Lash & Brow Bar', category: 'Lash Extensions', name: 'Hybrid Lash Extensions', description: 'Mix of classic and volume lashes for a textured, wispy look. Best of both worlds.', suggestedPriceRands: 700, suggestedDurationMin: 120 },
  { businessType: 'Lash & Brow Bar', category: 'Lash Extensions', name: 'Lash Fill / Infill (2 Weeks)', description: 'Infill for classic, hybrid, or volume lashes within 2 weeks. Gaps filled and fallen lashes replaced.', suggestedPriceRands: 350, suggestedDurationMin: 60 },
  { businessType: 'Lash & Brow Bar', category: 'Lash Extensions', name: 'Lash Fill / Infill (3 Weeks)', description: 'Infill for lash sets that are 3 weeks old. More gaps to fill — takes a little longer.', suggestedPriceRands: 450, suggestedDurationMin: 75 },
  { businessType: 'Lash & Brow Bar', category: 'Lash Extensions', name: 'Lash Extension Removal', description: 'Safe removal of all lash extensions using professional-grade remover. Natural lashes unharmed.', suggestedPriceRands: 150, suggestedDurationMin: 30 },
  { businessType: 'Lash & Brow Bar', category: 'Lash Treatments', name: 'Lash Lift', description: 'Natural lashes curled upward from the root using a silicone rod and lifting solution. No extensions. Lasts 6–8 weeks.', suggestedPriceRands: 450, suggestedDurationMin: 60 },
  { businessType: 'Lash & Brow Bar', category: 'Lash Treatments', name: 'Lash Lift & Tint', description: 'Lash lift combined with a keratin tint to darken and define lashes. No mascara needed for weeks!', suggestedPriceRands: 550, suggestedDurationMin: 75 },
  { businessType: 'Lash & Brow Bar', category: 'Lash Treatments', name: 'Lash Tint Only', description: 'Natural lashes dyed dark with a semi-permanent tint. Great for fair-lashed clients. Lasts 4–6 weeks.', suggestedPriceRands: 200, suggestedDurationMin: 30 },
  { businessType: 'Lash & Brow Bar', category: 'Brow Treatments', name: 'Brow Lamination', description: 'Brow hairs straightened and set in place upward for a fluffy, brushed-up look. Lasts 6–8 weeks.', suggestedPriceRands: 400, suggestedDurationMin: 60 },
  { businessType: 'Lash & Brow Bar', category: 'Brow Treatments', name: 'Brow Lamination + Tint', description: 'Brow lamination with tint to darken and define brows. Full, feathery, natural-looking results.', suggestedPriceRands: 520, suggestedDurationMin: 75 },
  { businessType: 'Lash & Brow Bar', category: 'Brow Treatments', name: 'Brow Tint', description: 'Semi-permanent dye applied to brows to add depth and definition. Great for sparse or light brows.', suggestedPriceRands: 150, suggestedDurationMin: 20 },
  { businessType: 'Lash & Brow Bar', category: 'Brow Treatments', name: 'Microblading (Eyebrows)', description: 'Semi-permanent tattooing technique that creates realistic individual hair strokes. Lasts 12–18 months. Touch-up included.', suggestedPriceRands: 2500, suggestedDurationMin: 120 },
  { businessType: 'Lash & Brow Bar', category: 'Brow Treatments', name: 'Powder / Ombré Brows', description: 'Semi-permanent makeup giving brows a soft, powdery, filled-in look. Lasts 1–3 years with touch-ups.', suggestedPriceRands: 2800, suggestedDurationMin: 150 },
  { businessType: 'Lash & Brow Bar', category: 'Brow Treatments', name: 'Microblading Touch-Up', description: 'Follow-up session 4–8 weeks after initial microblading to refine and perfect the result.', suggestedPriceRands: 800, suggestedDurationMin: 90 },

  // ── TATTOO & PIERCING ──────────────────────────────────────────────────────

  { businessType: 'Tattoo & Piercing', category: 'Tattoo', name: 'Tattoo Consultation', description: 'Free 30-minute consultation to discuss your design idea, placement, size, and get a price quote.', suggestedPriceRands: 0, suggestedDurationMin: 30 },
  { businessType: 'Tattoo & Piercing', category: 'Tattoo', name: 'Small Tattoo (Under 5cm)', description: 'Simple tattoo design — word, small symbol, or minimalist line art. Single session. Includes touch-up within 6 weeks.', suggestedPriceRands: 500, suggestedDurationMin: 60 },
  { businessType: 'Tattoo & Piercing', category: 'Tattoo', name: 'Medium Tattoo (5–15cm)', description: 'Medium-sized single tattoo. Detailed design, shading included. Price varies by complexity.', suggestedPriceRands: 1200, suggestedDurationMin: 120 },
  { businessType: 'Tattoo & Piercing', category: 'Tattoo', name: 'Large Tattoo / Sleeve Session', description: 'Large piece or sleeve work. Hourly rate applies. Price is per session — number of sessions depends on design.', suggestedPriceRands: 800, suggestedDurationMin: 60 },
  { businessType: 'Tattoo & Piercing', category: 'Tattoo', name: 'Cover-Up Tattoo', description: 'Existing tattoo covered with a new design. Consultation required to assess feasibility. Price from…', suggestedPriceRands: 1500, suggestedDurationMin: 180 },
  { businessType: 'Tattoo & Piercing', category: 'Piercing', name: 'Single Ear Lobe Piercing', description: 'Single lobe piercing with a titanium or surgical steel starter stud. Aftercare spray included.', suggestedPriceRands: 150, suggestedDurationMin: 15 },
  { businessType: 'Tattoo & Piercing', category: 'Piercing', name: 'Double Ear Lobe Piercing', description: 'Both earlobes pierced in one visit. Titanium starter studs included. Aftercare spray and instructions given.', suggestedPriceRands: 250, suggestedDurationMin: 20 },
  { businessType: 'Tattoo & Piercing', category: 'Piercing', name: 'Helix / Cartilage Piercing', description: 'Upper ear cartilage piercing with a flat-back or ring. Heals in 6–12 months with proper care.', suggestedPriceRands: 250, suggestedDurationMin: 20 },
  { businessType: 'Tattoo & Piercing', category: 'Piercing', name: 'Nose Stud Piercing', description: 'Nostril piercing with a titanium nose stud. Quick and clean. Aftercare spray included.', suggestedPriceRands: 200, suggestedDurationMin: 15 },
  { businessType: 'Tattoo & Piercing', category: 'Piercing', name: 'Belly Button Piercing', description: 'Navel piercing with curved titanium bar. Heals in 6–12 months. Full aftercare kit included.', suggestedPriceRands: 300, suggestedDurationMin: 20 },

  // ── RESTAURANT & CAFÉ ──────────────────────────────────────────────────────

  { businessType: 'Restaurant & Café', category: 'Breakfast', name: 'Full English Breakfast', description: 'Eggs (your way), bacon, boerewors sausage, grilled tomato, mushrooms, baked beans, and toast. Served with juice or filter coffee.', suggestedPriceRands: 120, suggestedDurationMin: 20 },
  { businessType: 'Restaurant & Café', category: 'Breakfast', name: 'Avo Toast', description: 'Thick-cut sourdough topped with smashed avocado, feta, cherry tomatoes, and a poached egg. Drizzled with olive oil.', suggestedPriceRands: 90, suggestedDurationMin: 10 },
  { businessType: 'Restaurant & Café', category: 'Breakfast', name: 'Breakfast Wrap', description: 'Scrambled eggs, bacon, cheddar, and chilli sauce in a toasted flour tortilla. A quick grab-and-go option.', suggestedPriceRands: 75, suggestedDurationMin: 10 },
  { businessType: 'Restaurant & Café', category: 'Breakfast', name: 'Waffle Stack', description: 'Fluffy Belgian waffles stacked with seasonal fruit, Greek yoghurt, granola, and maple syrup.', suggestedPriceRands: 95, suggestedDurationMin: 10 },
  { businessType: 'Restaurant & Café', category: 'Breakfast', name: 'Acai Bowl', description: 'Blended acai with banana and coconut milk, topped with granola, fresh fruit, honey, and peanut butter.', suggestedPriceRands: 85, suggestedDurationMin: 5 },

  { businessType: 'Restaurant & Café', category: 'Lunch / Mains', name: 'Gatsby (Full)', description: 'Cape Malay-style loaded sub with slap chips, choice of protein (steak, chicken, polony), and sauces.', suggestedPriceRands: 120, suggestedDurationMin: 15 },
  { businessType: 'Restaurant & Café', category: 'Lunch / Mains', name: 'Chicken Burger', description: 'Crispy fried chicken thigh, coleslaw, pickles, and secret sauce on a brioche bun. Served with chips.', suggestedPriceRands: 110, suggestedDurationMin: 15 },
  { businessType: 'Restaurant & Café', category: 'Lunch / Mains', name: 'Beef Burger', description: '200g beef patty, cheddar, caramelised onions, lettuce, tomato, and house sauce on a seeded bun. Served with chips.', suggestedPriceRands: 130, suggestedDurationMin: 15 },
  { businessType: 'Restaurant & Café', category: 'Lunch / Mains', name: 'Prego Roll', description: 'Tender sliced beef or chicken marinated in peri-peri sauce, served in a toasted Portuguese roll.', suggestedPriceRands: 95, suggestedDurationMin: 10 },
  { businessType: 'Restaurant & Café', category: 'Lunch / Mains', name: 'Chicken Caesar Salad', description: 'Romaine lettuce, grilled chicken strips, parmesan, croutons, and creamy Caesar dressing.', suggestedPriceRands: 110, suggestedDurationMin: 10 },
  { businessType: 'Restaurant & Café', category: 'Lunch / Mains', name: 'Boerie Roll', description: 'Braai boerewors in a toasted roll with tomato sauce, mustard, and onion relish. A South African classic.', suggestedPriceRands: 70, suggestedDurationMin: 10 },
  { businessType: 'Restaurant & Café', category: 'Lunch / Mains', name: 'Bunny Chow (Quarter)', description: 'Durban-style quarter loaf of white bread hollowed and filled with lamb or chicken curry. Iconic SA dish.', suggestedPriceRands: 95, suggestedDurationMin: 10 },
  { businessType: 'Restaurant & Café', category: 'Lunch / Mains', name: 'Pap & Wors', description: 'Stiff pap served with braai boerewors, chakalaka or tomato relish. Traditional and filling.', suggestedPriceRands: 90, suggestedDurationMin: 15 },
  { businessType: 'Restaurant & Café', category: 'Lunch / Mains', name: 'Grilled Chicken + Chips + Coleslaw', description: 'Quarter or half chicken grilled with a lemon-herb marinade, served with golden chips and homemade coleslaw.', suggestedPriceRands: 130, suggestedDurationMin: 15 },
  { businessType: 'Restaurant & Café', category: 'Lunch / Mains', name: 'Margherita Pizza (Medium)', description: 'Handmade dough base, tomato sauce, mozzarella, and fresh basil. Simple and always delicious.', suggestedPriceRands: 120, suggestedDurationMin: 20 },
  { businessType: 'Restaurant & Café', category: 'Lunch / Mains', name: 'Pasta (Bolognese)', description: 'Al dente pasta in a slow-cooked beef mince and tomato ragù, topped with grated parmesan.', suggestedPriceRands: 110, suggestedDurationMin: 15 },
  { businessType: 'Restaurant & Café', category: 'Lunch / Mains', name: 'Toasted Sandwich', description: 'Cheese and tomato, or ham and cheese in thick-cut bread, toasted golden. Add extras on request.', suggestedPriceRands: 60, suggestedDurationMin: 10 },
  { businessType: 'Restaurant & Café', category: 'Lunch / Mains', name: 'Vegetarian Wrap', description: 'Grilled vegetables, hummus, feta, and rocket in a wholegrain wrap. Healthy and satisfying.', suggestedPriceRands: 80, suggestedDurationMin: 10 },

  { businessType: 'Restaurant & Café', category: 'Drinks', name: 'Filter Coffee', description: 'Freshly brewed filter coffee. Served with milk and sugar on the side.', suggestedPriceRands: 25, suggestedDurationMin: 5 },
  { businessType: 'Restaurant & Café', category: 'Drinks', name: 'Cappuccino', description: 'Double espresso with steamed milk and a thick layer of foam. Made with [your bean brand].', suggestedPriceRands: 35, suggestedDurationMin: 5 },
  { businessType: 'Restaurant & Café', category: 'Drinks', name: 'Cold Brew Coffee', description: 'Coffee steeped in cold water for 12 hours for a smooth, low-acid iced coffee. Served over ice.', suggestedPriceRands: 45, suggestedDurationMin: 3 },
  { businessType: 'Restaurant & Café', category: 'Drinks', name: 'Rooibos Latte', description: 'SA-grown rooibos steeped and blended with frothy steamed milk. Caffeine-free and delicious.', suggestedPriceRands: 40, suggestedDurationMin: 5 },
  { businessType: 'Restaurant & Café', category: 'Drinks', name: 'Fresh Juice (Orange)', description: 'Freshly squeezed orange juice. 100% fruit, no added sugar.', suggestedPriceRands: 35, suggestedDurationMin: 3 },
  { businessType: 'Restaurant & Café', category: 'Drinks', name: 'Smoothie (Tropical)', description: 'Mango, pineapple, banana, and coconut water blended smooth. A sunshine in a cup.', suggestedPriceRands: 60, suggestedDurationMin: 5 },
  { businessType: 'Restaurant & Café', category: 'Drinks', name: 'Milkshake (Chocolate / Vanilla / Strawberry)', description: 'Thick creamy milkshake made with real ice cream. Available in chocolate, vanilla, or strawberry.', suggestedPriceRands: 55, suggestedDurationMin: 5 },
  { businessType: 'Restaurant & Café', category: 'Drinks', name: 'Soft Drink (Can)', description: 'Coke, Coke Zero, Sprite, Fanta, or Cream Soda. Served cold.', suggestedPriceRands: 20, suggestedDurationMin: 1 },
  { businessType: 'Restaurant & Café', category: 'Drinks', name: 'Water (Still / Sparkling)', description: 'Still or sparkling mineral water. 500ml bottle.', suggestedPriceRands: 15, suggestedDurationMin: 1 },

  { businessType: 'Restaurant & Café', category: 'Desserts', name: 'Malva Pudding', description: 'Classic SA sponge pudding soaked in apricot syrup, served hot with custard or ice cream.', suggestedPriceRands: 65, suggestedDurationMin: 10 },
  { businessType: 'Restaurant & Café', category: 'Desserts', name: 'Chocolate Cake (Slice)', description: 'Rich, moist chocolate layer cake with chocolate ganache. A crowd favourite.', suggestedPriceRands: 55, suggestedDurationMin: 5 },
  { businessType: 'Restaurant & Café', category: 'Desserts', name: 'Cheesecake (Slice)', description: 'Creamy baked cheesecake on a biscuit base. Served with berry coulis.', suggestedPriceRands: 65, suggestedDurationMin: 5 },
  { businessType: 'Restaurant & Café', category: 'Desserts', name: 'Waffle + Ice Cream', description: 'Crispy Belgian waffle topped with a scoop of vanilla ice cream and chocolate or caramel sauce.', suggestedPriceRands: 70, suggestedDurationMin: 5 },

  // Kids Meals
  { businessType: 'Restaurant & Café', category: "Kids Menu", name: "Kids Grilled Chicken & Chips", description: "Tender grilled chicken pieces with crispy chips. Includes a juice box. 🍗", suggestedPriceRands: 75, suggestedDurationMin: 15 },
  { businessType: 'Restaurant & Café', category: "Kids Menu", name: "Kids Mac & Cheese", description: "Creamy macaroni and cheese, just the way kids love it. Served with garlic bread.", suggestedPriceRands: 65, suggestedDurationMin: 10 },
  { businessType: 'Restaurant & Café', category: "Kids Menu", name: "Kids Mini Burger & Chips", description: "Small beef or chicken patty on a soft bun with ketchup. Served with a small chips. 🍔", suggestedPriceRands: 70, suggestedDurationMin: 10 },

  // ── BEAUTY BOUTIQUE / GENERAL SHOP ────────────────────────────────────────

  { businessType: 'Shop / Retail', category: 'Hair Products', name: 'Shea Butter (250ml)', description: 'Pure raw shea butter for hair and skin moisturising. Ideal for natural hair and relaxed styles.', suggestedPriceRands: 80, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Hair Products', name: 'Edge Control (Strong Hold)', description: 'High-hold edge control gel for slick edges and baby hair. Long-lasting with no flaking.', suggestedPriceRands: 60, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Hair Products', name: 'Leave-In Conditioner', description: 'Lightweight leave-in conditioner for moisture, detangling, and softness. Suitable for all hair types.', suggestedPriceRands: 120, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Hair Products', name: 'Hair Growth Oil', description: 'Castor, rosemary, and peppermint oil blend to stimulate growth and reduce breakage.', suggestedPriceRands: 150, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Hair Products', name: 'Kanekalon Hair (Pack)', description: 'Single pack of kanekalon braiding hair. Available in black, 1B, 33, and various colours.', suggestedPriceRands: 40, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Skincare', name: 'Vitamin C Serum (30ml)', description: 'Brightening vitamin C serum to even skin tone and fade dark marks. Suitable for melanin-rich skin.', suggestedPriceRands: 250, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Skincare', name: 'SPF 50 Sunscreen (50ml)', description: 'Lightweight, non-greasy SPF 50 sunscreen. Mineral and chemical blend. No white cast.', suggestedPriceRands: 180, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Skincare', name: 'Coconut Oil (500ml)', description: 'Pure cold-pressed coconut oil. Multi-use for hair, skin, and cooking.', suggestedPriceRands: 90, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Nail Products', name: 'Gel Nail Polish (Bottle)', description: 'Professional-grade gel nail polish. UV/LED curable. Wide range of colours available.', suggestedPriceRands: 120, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Accessories', name: 'Satin Sleep Cap', description: 'Satin-lined sleep cap to protect hair and reduce breakage overnight. One size fits most.', suggestedPriceRands: 80, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Accessories', name: 'Wide-Tooth Comb', description: 'Seamless wide-tooth comb for gentle detangling on wet natural or relaxed hair.', suggestedPriceRands: 35, suggestedDurationMin: 0 },

  // ── CANNABIS DISPENSARY ────────────────────────────────────────────────────

  { businessType: 'Shop / Retail', category: 'Cannabis (Dry Herb)', name: 'Indica Strain (1g)', description: 'Premium indica flower — relaxing, body-heavy effects. Great for evening use and sleep. Lab-tested. THC [X]%.', suggestedPriceRands: 80, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Cannabis (Dry Herb)', name: 'Sativa Strain (1g)', description: 'Uplifting sativa flower — energising and creative. Best for daytime use. Lab-tested. THC [X]%.', suggestedPriceRands: 80, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Cannabis (Dry Herb)', name: 'Hybrid Strain (1g)', description: 'Balanced hybrid — equal indica/sativa effects. Versatile and popular. Lab-tested. THC [X]%.', suggestedPriceRands: 80, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Cannabis (Dry Herb)', name: 'Premium "Top Shelf" Strain (1g)', description: 'Small-batch, craft-grown flower. Exceptionally dense buds, rich terpene profile. [Strain name] THC [X]%.', suggestedPriceRands: 150, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Cannabis (Dry Herb)', name: 'Budget Blend (3.5g)', description: 'Value eighth of our everyday blend. Great for regular users. Lab-tested.', suggestedPriceRands: 200, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Cannabis (Pre-rolls)', name: 'Pre-Roll (Single)', description: 'Pre-rolled joint with [strain]. 0.5g or 1g available. Ready to go — no rolling skills needed.', suggestedPriceRands: 60, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Cannabis (Pre-rolls)', name: 'Pre-Roll Pack (5)', description: 'Pack of 5 pre-rolled joints. Mix of strains or single strain. Perfect for sharing.', suggestedPriceRands: 250, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Cannabis (Edibles)', name: 'Cannabis Gummies (Pack of 10)', description: 'Infused fruit gummies, 10mg THC each. Slow onset — start with one. Lab-tested and precisely dosed.', suggestedPriceRands: 300, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Cannabis (Edibles)', name: 'Cannabis Chocolate Bar', description: 'Artisan chocolate infused with [X]mg THC total. Break into squares for controlled dosing.', suggestedPriceRands: 250, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Cannabis (Wellness)', name: 'CBD Oil (500mg, 30ml)', description: 'Full-spectrum or broad-spectrum CBD oil. 500mg per bottle. For anxiety, sleep, and inflammation support.', suggestedPriceRands: 450, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Cannabis (Wellness)', name: 'CBD Capsules (30 caps)', description: 'Easy-dose 25mg CBD capsules. No taste, no mess. Lab-tested and third-party verified.', suggestedPriceRands: 500, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Cannabis (Accessories)', name: 'Rolling Papers (Pack)', description: 'Thin, slow-burning rolling papers. King size or regular. Natural unbleached option available.', suggestedPriceRands: 25, suggestedDurationMin: 0 },
  { businessType: 'Shop / Retail', category: 'Cannabis (Accessories)', name: 'Glass Pipe', description: 'Handblown borosilicate glass pipe. Clean, flavourful hits. Various colours available.', suggestedPriceRands: 150, suggestedDurationMin: 0 },

  // ── MORE SALON / SPA ADD-ONS ───────────────────────────────────────────────

  { businessType: 'Hair Salon', category: 'Add-Ons', name: 'Hair Wash & Dry (Add-On)', description: 'Shampoo and blowout added to any styling service. Keeps your hair clean and fresh for the style.', suggestedPriceRands: 80, suggestedDurationMin: 20 },
  { businessType: 'Hair Salon', category: 'Add-Ons', name: 'Deep Condition (Add-On)', description: 'Protein or moisture deep conditioning treatment added to any wash service. Strengthens and hydrates.', suggestedPriceRands: 60, suggestedDurationMin: 20 },
  { businessType: 'Hair Salon', category: 'Add-Ons', name: 'Hair Steaming (Add-On)', description: 'Steam added to deep conditioner for better penetration. 15 minutes under the steamer.', suggestedPriceRands: 50, suggestedDurationMin: 15 },
  { businessType: 'Barber Shop', category: 'Add-Ons', name: 'Hot Towel Treatment (Add-On)', description: 'Hot towel wrapped around the face post-shave to open pores and soothe skin. Pure luxury.', suggestedPriceRands: 30, suggestedDurationMin: 5 },
  { businessType: 'Massage & Spa', category: 'Add-Ons', name: 'Aromatherapy Oil Upgrade', description: 'Upgrade your massage to include a customised aromatherapy oil blend. Chosen based on your mood.', suggestedPriceRands: 80, suggestedDurationMin: 0 },
  { businessType: 'Skincare & Facials', category: 'Add-Ons', name: 'Eye Treatment (Add-On)', description: 'Under-eye patches and targeted eye cream added to any facial. Reduces puffiness and dark circles.', suggestedPriceRands: 100, suggestedDurationMin: 10 },
  { businessType: 'Nail Bar', category: 'Add-Ons', name: 'Nail Gems / Crystals (Set)', description: 'Swarovski or resin gems applied to nails as accent design. Price is per nail.', suggestedPriceRands: 15, suggestedDurationMin: 5 },

  // Extra barber / hair
  { businessType: 'Barber Shop', category: 'Male Cuts', name: 'Dreadlock Retwist (Short Locs)', description: 'New growth at roots palm rolled and retwisted to keep short locs tidy and growing healthy.', suggestedPriceRands: 200, suggestedDurationMin: 60 },
  { businessType: 'Hair Salon', category: 'Natural Hair', name: 'Protective Style Updo', description: 'Natural hair styled into an updo using twists, braids, or coils pinned up. No extensions. Formal or casual look.', suggestedPriceRands: 200, suggestedDurationMin: 60 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Two-Strand Twists (No Extensions)', description: 'Natural hair twisted into two-strand twists throughout the head. Can be worn as-is or unravelled for a twist-out.', suggestedPriceRands: 180, suggestedDurationMin: 75 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Havana Twists', description: 'Thick, chunky twists using Havana marley hair. Bold protective style that lasts 4–6 weeks.', suggestedPriceRands: 500, suggestedDurationMin: 210 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Spring Twists / Curly Crotchet Twists', description: 'Pre-made curly crotchet twists installed for a bouncy, defined look. Lightweight and quick to install.', suggestedPriceRands: 450, suggestedDurationMin: 180 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Crotchet Braids (Full Head)', description: 'Pre-looped hair crocheted onto cornrow base using a latch hook. Fast, versatile, and natural-looking.', suggestedPriceRands: 400, suggestedDurationMin: 150 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Goddess Braids (Large)', description: 'Oversized cornrows with curly hair woven in at the ends for a boho, goddess look.', suggestedPriceRands: 450, suggestedDurationMin: 150 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Tribal Braids', description: 'Cornrows in an intricate pattern with loose braids hanging. Often includes beads and gold cuffs.', suggestedPriceRands: 550, suggestedDurationMin: 240 },
  { businessType: 'Hair Salon', category: 'Braids & Twists', name: 'Braid Takedown / Removal', description: 'Careful removal of box braids, cornrows, twists, or crotchet styles. Includes detangle and wash.', suggestedPriceRands: 200, suggestedDurationMin: 90 },

  // Extra massage
  { businessType: 'Massage & Spa', category: 'Massage', name: 'Trigger Point Therapy (30 min)', description: 'Targeted pressure applied to tight knots (trigger points) causing referred pain. Great for chronic tension.', suggestedPriceRands: 300, suggestedDurationMin: 30 },
  { businessType: 'Massage & Spa', category: 'Massage', name: 'Lymphatic Drainage Massage', description: 'Gentle rhythmic strokes to stimulate the lymphatic system, reduce swelling, and detoxify the body.', suggestedPriceRands: 600, suggestedDurationMin: 60 },
  { businessType: 'Massage & Spa', category: 'Massage', name: 'Bamboo Massage', description: 'Heated bamboo sticks rolled and kneaded over muscles for deep, penetrating warmth. Deeply relaxing.', suggestedPriceRands: 600, suggestedDurationMin: 60 },
  { businessType: 'Massage & Spa', category: 'Spa Packages', name: 'Birthday Pamper Package', description: 'The birthday VIP experience — massage, facial, manicure, and a glass of bubbly. Perfect gift.', suggestedPriceRands: 1800, suggestedDurationMin: 240 },
];

export const SERVICE_CATEGORIES_BY_TYPE: Record<string, string[]> = SERVICE_TEMPLATES.reduce(
  (acc, t) => {
    if (!acc[t.businessType]) acc[t.businessType] = [];
    if (!acc[t.businessType].includes(t.category)) acc[t.businessType].push(t.category);
    return acc;
  },
  {} as Record<string, string[]>,
);

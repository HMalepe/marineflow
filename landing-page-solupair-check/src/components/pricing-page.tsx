import { PricingCategoriesSection } from "@/components/pricing-categories-section";
import { useSectionInView } from "@/hooks/use-section-in-view";
import {
  PRICING_FACTORS,
  PRICING_GENERAL_POINTS,
  PRICING_TIERS,
} from "@/lib/pricing-tiers";

export function PricingPageContent() {
  const { sectionRef, sectionInView } = useSectionInView({ threshold: 0.08 });

  return (
    <div
      ref={sectionRef}
      className={`pricing-page-content relative z-10 mx-auto w-full max-w-7xl px-4 pb-20 pt-8 sm:px-10 sm:pb-28 sm:pt-12 lg:px-14 lg:pb-32 lg:pt-14${sectionInView ? " pricing-in-view" : ""}`}
    >
      <header className="pricing-direction-header">
        <p className="pricing-page-eyebrow pricing-reveal pricing-reveal--heading">
          Starting estimates · not fixed packages
        </p>
        <h1
          id="pricing-heading"
          className="pricing-direction-heading pricing-reveal pricing-reveal--heading font-display font-black uppercase tracking-tighter text-foreground"
        >
          Pricing &amp; estimates
        </h1>
        <p className="pricing-direction-subtitle pricing-reveal pricing-reveal--subtitle">
          Indicative costs for the digital solutions we build — by business type and by project
          tier. Every figure is a starting estimate; your final quote is scoped after we
          understand your workflow.
        </p>
      </header>

      <aside className="pricing-estimate-banner pricing-reveal pricing-reveal--subtitle">
        <p className="pricing-estimate-banner__title">How to read these numbers</p>
        <p className="pricing-estimate-banner__body">
          Prices differ from client to client. What you see here are <strong>estimates</strong>,
          not final invoices. Setup fees, monthly running costs and year-one totals are
          generalisations based on similar builds — your quote reflects team size, tools,
          content, integrations and how much automation you actually need. We confirm everything
          in writing before work begins.
        </p>
      </aside>

      <PricingCategoriesSection />

      <header className="pricing-direction-header pricing-direction-header--tiers">
        <p className="pricing-page-eyebrow pricing-reveal pricing-reveal--heading">
          Build tiers · starting points
        </p>
        <h2 className="pricing-direction-heading pricing-reveal pricing-reveal--heading font-display font-black uppercase tracking-tighter text-foreground">
          Start with the system you need
        </h2>
        <p className="pricing-direction-subtitle pricing-reveal pricing-reveal--subtitle">
          Simple builds, clean dashboards and custom automation. The tiers below complement the
          sector examples above — use them to gauge where your project might begin.
        </p>
      </header>

      <div className="pricing-direction-grid">
        {PRICING_TIERS.map((tier, index) => (
          <article
            key={tier.id}
            className={`pricing-card pricing-reveal pricing-reveal--card${tier.featured ? " pricing-card--featured" : ""}`}
            style={{ animationDelay: `${0.18 + index * 0.1}s` }}
          >
            <div className="pricing-card__top">
              <h2 className="pricing-card__title">{tier.title}</h2>
              <p className="pricing-card__estimate-label">{tier.estimateNote}</p>
              <p className="pricing-card__price">
                {tier.price}
                {tier.price !== "Custom quote" && (
                  <span className="pricing-card__price-suffix"> est.</span>
                )}
              </p>
              <p className="pricing-card__desc">{tier.description}</p>
            </div>

            <ul className="pricing-card__includes">
              {tier.includes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <p className="pricing-card__footnote">
              Final amount confirmed after discovery — may be lower or higher than this range.
            </p>

            <a
              href="/#contact"
              className={`pricing-card__cta hero-btn touch-target ${tier.featured ? "hero-btn--primary" : "hero-btn--secondary"}`}
            >
              <span>{tier.cta}</span>
            </a>
          </article>
        ))}
      </div>

      <section className="pricing-factors" aria-labelledby="pricing-factors-heading">
        <h2
          id="pricing-factors-heading"
          className="pricing-factors__heading pricing-reveal pricing-reveal--note font-display font-black uppercase tracking-tighter text-foreground"
        >
          What usually changes the estimate
        </h2>
        <p className="pricing-factors__intro pricing-reveal pricing-reveal--note">
          No two operations look the same. These are the most common reasons one salon, clinic or
          retail team pays more or less than another — even for a similar-sounding build.
        </p>
        <ul className="pricing-factors__grid">
          {PRICING_FACTORS.map((factor, index) => (
            <li
              key={factor.title}
              className="pricing-factor-card pricing-reveal pricing-reveal--card"
              style={{ animationDelay: `${0.12 + index * 0.06}s` }}
            >
              <h3 className="pricing-factor-card__title">{factor.title}</h3>
              <p className="pricing-factor-card__body">{factor.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="pricing-general-notes" aria-labelledby="pricing-notes-heading">
        <h2 id="pricing-notes-heading" className="sr-only">
          General pricing notes
        </h2>
        <ul className="pricing-general-notes__list">
          {PRICING_GENERAL_POINTS.map((point, index) => (
            <li
              key={point}
              className="pricing-general-notes__item pricing-reveal pricing-reveal--note"
              style={{ animationDelay: `${0.2 + index * 0.05}s` }}
            >
              {point}
            </li>
          ))}
        </ul>
      </section>

      <p className="pricing-direction-note pricing-reveal pricing-reveal--note">
        All figures are indicative starting estimates in ZAR. Final pricing depends on scope,
        integrations, content, timeline and support — and is always agreed with you before
        development starts.
      </p>

      <div className="pricing-page-cta pricing-reveal pricing-reveal--note">
        <p className="pricing-page-cta__text">
          Not sure which tier fits? Send a short message — we will suggest the leanest path and
          a realistic estimate for your situation.
        </p>
        <a href="/#contact" className="hero-btn hero-btn--primary touch-target">
          <span>Get a tailored estimate</span>
        </a>
      </div>
    </div>
  );
}

import type { MouseEvent } from "react";
import { useDeviceProfile } from "@/hooks/use-device-profile";
import { useSectionInView } from "@/hooks/use-section-in-view";
import { navigateToSection } from "@/lib/section-nav";

const PRICING_TIERS = [
  {
    id: "starter",
    title: "Starter Website",
    price: "From R3,500",
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

export function PricingDirectionSection() {
  const { sectionRef, sectionInView } = useSectionInView({ threshold: 0.12 });
  const { prefersReducedMotion } = useDeviceProfile();

  const goToContact = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigateToSection("contact", prefersReducedMotion);
  };

  return (
    <section
      ref={sectionRef}
      id="pricing"
      data-scroll-snap="pricing"
      aria-labelledby="pricing-heading"
      className={`pricing-direction safe-area-x section-surface snap-section-flow relative isolate overflow-x-clip px-4 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-28${sectionInView ? " pricing-in-view" : ""}`}
    >
      <div className="pricing-direction-glow pricing-direction-glow--left" aria-hidden />
      <div className="pricing-direction-glow pricing-direction-glow--right" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <header className="pricing-direction-header">
          <h2
            id="pricing-heading"
            className="pricing-direction-heading pricing-reveal pricing-reveal--heading font-display font-black uppercase tracking-tighter text-foreground"
          >
            Start with the system you need
          </h2>
          <p className="pricing-direction-subtitle pricing-reveal pricing-reveal--subtitle">
            Simple builds, clean dashboards and custom automation. Start small, then upgrade as
            your operations grow.
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
                <h3 className="pricing-card__title">{tier.title}</h3>
                <p className="pricing-card__price">{tier.price}</p>
                <p className="pricing-card__desc">{tier.description}</p>
              </div>

              <ul className="pricing-card__includes">
                {tier.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <a
                href="#contact"
                onClick={goToContact}
                className={`pricing-card__cta hero-btn touch-target ${tier.featured ? "hero-btn--primary" : "hero-btn--secondary"}`}
              >
                <span>{tier.cta}</span>
              </a>
            </article>
          ))}
        </div>

        <p className="pricing-direction-note pricing-reveal pricing-reveal--note">
          Final pricing depends on scope, integrations, content and support needs.
        </p>
      </div>
    </section>
  );
}

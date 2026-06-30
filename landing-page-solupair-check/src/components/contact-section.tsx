import { ViewportPhysicsBalls } from "@/components/viewport-physics-balls";
import { ContactHelixBackground } from "@/components/contact-helix-background";
import { useSectionInView } from "@/hooks/use-section-in-view";

export function ContactSection() {
  const { sectionRef, sectionInView } = useSectionInView({
    threshold: 0.14,
    rootMargin: "0px 0px -6% 0px",
  });

  return (
    <section
      ref={sectionRef}
      id="contact"
      data-scroll-snap="contact"
      aria-labelledby="contact-heading"
      className={`contact-section safe-area-x section-surface snap-section-compact relative isolate flex flex-col justify-start overflow-x-clip px-4 pt-10 pb-14 sm:px-10 sm:pt-12 sm:pb-20 lg:px-14 lg:pt-14 lg:pb-24${sectionInView ? " contact-in-view" : ""}`}
    >
      <div className="contact-helix-anchor" aria-hidden>
        <ContactHelixBackground />
        <div className="contact-helix-glow-line" />
      </div>
      <ViewportPhysicsBalls variant="contact" />
      <div className="contact-shell relative z-10 mx-auto w-full max-w-7xl border-t border-subtle pt-6 sm:pt-8 lg:pt-10">
        <div className="contact-grid">
          <div className="contact-intro">
            <h2
              id="contact-heading"
              className="contact-heading contact-reveal contact-reveal--heading font-display font-black uppercase tracking-tighter text-foreground"
            >
              Let&apos;s Talk
            </h2>
            <p className="contact-lead contact-reveal contact-reveal--lead">
              Tell us what you need. We&apos;ll reply with the best next step, rough scope and
              starting price range.
            </p>
          </div>

          <aside className="contact-details contact-reveal contact-reveal--details">
            <div className="contact-details-block">
              <div className="contact-details-label">Email</div>
              <a
                href="mailto:info@solupair.co.za"
                className="contact-text-link mt-1 block break-all text-base text-foreground transition hover:text-brand-cyan"
              >
                info@solupair.co.za
              </a>
            </div>
            <div className="contact-details-block">
              <div className="contact-details-label">Location</div>
              <p className="contact-details-copy">
                South Africa · Johannesburg &amp; Cape Town · Remote-first
              </p>
            </div>
          </aside>

          <form
            onSubmit={(e) => e.preventDefault()}
            className="contact-form contact-reveal contact-reveal--form"
          >
            <div
              className="contact-field contact-reveal contact-reveal--field"
              style={{ animationDelay: "0.22s" }}
            >
              <label htmlFor="contact-name" className="contact-field-label">
                Your name
              </label>
              <input
                id="contact-name"
                type="text"
                name="name"
                autoComplete="name"
                placeholder="Your name"
                className="contact-form-input mobile-input"
              />
            </div>

            <div
              className="contact-field contact-reveal contact-reveal--field"
              style={{ animationDelay: "0.3s" }}
            >
              <label htmlFor="contact-email" className="contact-field-label">
                Your email
              </label>
              <input
                id="contact-email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@company.com"
                className="contact-form-input mobile-input"
              />
            </div>

            <div
              className="contact-field contact-reveal contact-reveal--field"
              style={{ animationDelay: "0.38s" }}
            >
              <label htmlFor="contact-message" className="contact-field-label">
                Tell us about your project
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={4}
                placeholder="What are you building? Timeline, goals, current pain points…"
                className="contact-form-input contact-form-input--message mobile-input"
              />
            </div>

            <button
              type="submit"
              className="contact-submit-btn hero-btn hero-btn--primary contact-reveal contact-reveal--submit touch-target"
              style={{ animationDelay: "0.48s" }}
            >
              <span>Send project request</span>
            </button>

            <p className="contact-form-reassurance contact-reveal contact-reveal--field" style={{ animationDelay: "0.56s" }}>
              No spam — we reply within 1–2 business days with scope and a starting price range.
            </p>
          </form>
        </div>

        <div className="safe-area-bottom contact-footer mt-10 flex flex-col items-start justify-between gap-3 border-t border-subtle pt-6 text-[10px] uppercase tracking-[0.18em] text-text-dim sm:mt-14 sm:flex-row sm:items-center sm:gap-4 sm:text-[11px] sm:tracking-[0.2em] lg:mt-16">
          <div>© 2026 Solupair Pty Ltd. All rights reserved.</div>
          <div className="flex gap-6">
            <a
              href="#"
              className="contact-footer-link touch-target transition hover:text-brand-cyan"
              onClick={(e) => e.preventDefault()}
            >
              Privacy
            </a>
            <a
              href="#"
              className="contact-footer-link touch-target transition hover:text-brand-cyan"
              onClick={(e) => e.preventDefault()}
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

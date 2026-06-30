import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { useDeviceProfile } from "@/hooks/use-device-profile";
import solupairLogo from "@/assets/solupair-logo.png";
import solupairWordmark from "@/assets/solupair-wordmark.png";
import { ContactHelixBackground } from "@/components/contact-helix-background";
import { HeroFaceBall } from "@/components/hero-face-ball";
import { ViewportPhysicsBalls } from "@/components/viewport-physics-balls";
import { FinalCtaSection } from "@/components/final-cta-section";
import { PricingDirectionSection } from "@/components/pricing-direction-section";
import { ProjectsSection } from "@/components/projects-section";
import { WhatWeBuildSection } from "@/components/what-we-build-section";
import { WhoThisIsForSection } from "@/components/who-this-is-for-section";

export const Route = createFileRoute("/")({
  component: NovaHome,
});

function SolupairLogo() {
  return (
    <a
      href="https://solupair.co.za"
      className="site-logo inline-flex min-w-0 flex-row items-center gap-2 sm:gap-3 lg:gap-4"
      aria-label="Solupair"
    >
      <img
        src={solupairLogo}
        alt=""
        aria-hidden
        width={1536}
        height={1206}
        decoding="async"
        className="site-logo-mark w-auto shrink-0 object-contain object-left"
      />
      <div className="site-logo-copy min-w-0">
        <div className="site-logo-wordmark-wrap overflow-hidden">
          <img
            src={solupairWordmark}
            alt="Solupair"
            width={1600}
            height={153}
            decoding="async"
            className="site-logo-wordmark h-full w-auto object-contain object-left object-top"
          />
        </div>
        <p className="site-logo-tagline hidden md:block">
          Digital systems for service businesses and teams
        </p>
      </div>
    </a>
  );
}

function Hero() {
  const heroGroundRef = useRef<HTMLElement>(null);

  return (
    <section
      id="hero"
      data-scroll-snap="hero"
      ref={heroGroundRef}
      className="hero-section safe-area-x snap-section-panel relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-x-clip overflow-y-hidden"
    >
      <div className="hero-bg" aria-hidden>
        <div className="hero-bg-base" />
        <div className="hero-bg-grid" />
        <svg
          className="hero-bg-circuit"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="heroCircuitGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--brand-cyan)" stopOpacity="0" />
              <stop offset="40%" stopColor="var(--brand-cyan)" stopOpacity="0.5" />
              <stop offset="60%" stopColor="var(--brand-pink)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--brand-pink)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M80 520 H320 L380 460 H620 L680 500 H920"
            fill="none"
            stroke="url(#heroCircuitGrad)"
            strokeWidth="1"
            opacity="0.28"
          />
          <path
            d="M1360 280 H1100 L1040 340 H780 L720 300 H480"
            fill="none"
            stroke="url(#heroCircuitGrad)"
            strokeWidth="1"
            opacity="0.22"
          />
          <path
            d="M200 180 V320 L360 380 H520"
            fill="none"
            stroke="url(#heroCircuitGrad)"
            strokeWidth="1"
            opacity="0.18"
          />
          <circle cx="380" cy="460" r="2.5" fill="var(--brand-cyan)" opacity="0.45" />
          <circle cx="680" cy="500" r="2" fill="var(--brand-cyan)" opacity="0.4" />
          <circle cx="1040" cy="340" r="2.5" fill="var(--brand-pink)" opacity="0.4" />
          <circle cx="360" cy="380" r="2" fill="var(--brand-pink)" opacity="0.35" />
        </svg>
        <div className="hero-bg-glow hero-bg-glow--cyan" />
        <div className="hero-bg-glow hero-bg-glow--pink" />
        <div className="hero-bg-glow hero-bg-glow--purple" />
        <div className="hero-bg-grain" />
      </div>

      <HeroFaceBall groundRef={heroGroundRef} />

      <header className="site-header hero-reveal hero-reveal--header safe-area-top relative z-20 shrink-0">
        <div className="site-header-bar">
          <div className="site-header-inner">
            <SolupairLogo />
            <nav className="site-nav" aria-label="Primary">
              <a href="#work" className="site-nav-link site-nav-link--secondary">
                <span className="site-nav-label site-nav-label--short">Projects</span>
                <span className="site-nav-label site-nav-label--full">See projects</span>
              </a>
              <a href="#contact" className="site-nav-link site-nav-link--primary">
                <span className="site-nav-label site-nav-label--short">Start</span>
                <span className="site-nav-label site-nav-label--full">Start a project</span>
              </a>
            </nav>
          </div>
        </div>
      </header>

      <div className="hero-content relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center">
        <div className="hero-reveal hero-reveal--eyebrow flex justify-center">
          <p className="hero-eyebrow">
            Websites<span className="hero-eyebrow-sep" aria-hidden>·</span>
            Dashboards<span className="hero-eyebrow-sep" aria-hidden>·</span>
            WhatsApp<span className="hero-eyebrow-sep" aria-hidden>·</span>
            Automation
          </p>
        </div>

        <div className="hero-stage relative w-full min-w-0 text-center">
          <div className="hero-headline-scrim" aria-hidden />

          <h1 className="relative z-[1] w-full min-w-0 text-center">
            <span className="hero-reveal hero-reveal--headline-a hero-headline hero-headline-text hero-headline-text--a">
              DIGITAL{" "}
              <span className="hero-headline-gradient">SOLUTIONS</span>
            </span>
            <span className="hero-reveal hero-reveal--headline-b hero-headline hero-headline-text hero-headline-text--b">
              <span className="hero-headline-phrase">FOR YOUR</span>{" "}
              <span className="hero-headline-phrase">BUSINESS</span>
            </span>
          </h1>
        </div>

        <p className="hero-reveal hero-reveal--subheading hero-subheading text-center">
          Premium websites, dashboards and automated workflows for teams that need smoother
          bookings, sharper visibility and faster operations.
        </p>

        <div className="hero-reveal hero-reveal--ctas hero-ctas">
          <a href="#contact" className="hero-btn hero-btn--primary">
            <span>Start a project</span>
          </a>
          <a href="#work" className="hero-btn hero-btn--secondary">
            <span>See projects</span>
          </a>
        </div>

        <p className="hero-reveal hero-reveal--trust hero-trust-line text-center">
          Built for service businesses, retail teams and operators who need systems that actually
          work.
        </p>

        <ul
          className="hero-reveal hero-reveal--trust-strip hero-trust-strip"
          aria-label="Trust signals"
        >
          <li className="hero-trust-strip__item">South African-built</li>
          <li className="hero-trust-strip__item">Mobile-first</li>
          <li className="hero-trust-strip__item">WhatsApp-ready</li>
          <li className="hero-trust-strip__item">Dashboard-focused</li>
          <li className="hero-trust-strip__item">Remote-first delivery</li>
        </ul>
      </div>
    </section>
  );
}

function Contact() {
  const sectionRef = useRef<HTMLElement>(null);
  const [sectionInView, setSectionInView] = useState(false);
  const { prefersReducedMotion } = useDeviceProfile();

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    if (prefersReducedMotion) {
      setSectionInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setSectionInView(true);
        observer.disconnect();
      },
      { threshold: 0.14, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  return (
    <section
      ref={sectionRef}
      id="contact"
      data-scroll-snap="contact"
      className={`contact-section safe-area-x section-surface snap-section-compact relative isolate flex flex-col justify-start overflow-hidden px-4 pt-10 pb-14 sm:px-10 sm:pt-12 sm:pb-20 lg:px-14 lg:pt-14 lg:pb-24${sectionInView ? " contact-in-view" : ""}`}
    >
      <div className="contact-helix-anchor" aria-hidden>
        <ContactHelixBackground />
        <div className="contact-helix-glow-line" />
      </div>
      <ViewportPhysicsBalls variant="contact" />
      <div className="contact-shell relative z-10 mx-auto w-full max-w-7xl border-t border-subtle pt-6 sm:pt-8 lg:pt-10">
        <div className="contact-grid">
          <div className="contact-intro">
            <h2 className="contact-heading contact-reveal contact-reveal--heading font-display font-black uppercase tracking-tighter text-foreground">
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

function NovaHome() {
  return (
    <main className="scroll-snap-canvas min-h-[100dvh] bg-background font-sans text-foreground">
      <Hero />
      <WhatWeBuildSection />
      <WhoThisIsForSection />
      <PricingDirectionSection />
      <ProjectsSection />
      <FinalCtaSection />
      <Contact />
    </main>
  );
}
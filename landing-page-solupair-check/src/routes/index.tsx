import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useRef, useState, useCallback, useEffect } from "react";
import { useDeviceProfile } from "@/hooks/use-device-profile";
import solupairLogo from "@/assets/solupair-logo.png";
import solupairWordmark from "@/assets/solupair-wordmark.png";
import { ContactHelixBackground } from "@/components/contact-helix-background";
import { HeroFaceBall } from "@/components/hero-face-ball";
import { ViewportPhysicsBalls } from "@/components/viewport-physics-balls";
import { ProjectShowcaseSlider, type ShowcaseSliderHandle } from "@/components/project-showcase-slider";
import { PROJECT_SHOWCASES } from "@/components/project-showcases";
import { FinalCtaSection } from "@/components/final-cta-section";
import { PricingDirectionSection } from "@/components/pricing-direction-section";
import { ProjectValueCards } from "@/components/project-value-cards";
import { WhatWeBuildSection } from "@/components/what-we-build-section";
import { WhoThisIsForSection } from "@/components/who-this-is-for-section";
import { useScrollChoreography } from "@/hooks/use-scroll-choreography";
import {
  getNearestSnapIndex,
  projectIndexFromSnapId,
  scrollToSnap,
  snapIdFromProjectIndex,
  SNAP_ORDER,
} from "@/lib/scroll-choreography";

export const Route = createFileRoute("/")({
  component: NovaHome,
});

const projects = PROJECT_SHOWCASES;

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

function Projects() {
  const sectionRef = useRef<HTMLElement>(null);
  const sliderRef = useRef<ShowcaseSliderHandle>(null);
  const scrollIndexRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const didSwipeRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sectionInView, setSectionInView] = useState(false);
  const { prefersReducedMotion, coarsePointer } = useDeviceProfile();

  const goToProject = useCallback((index: number, options?: { syncScroll?: boolean }) => {
    const clamped = Math.min(projects.length - 1, Math.max(0, index));
    scrollIndexRef.current = clamped;
    setActiveIndex(clamped);

    if (!options?.syncScroll) return;

    const behavior = prefersReducedMotion ? "auto" : "smooth";
    scrollToSnap(snapIdFromProjectIndex(clamped), behavior);
  }, [prefersReducedMotion]);

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
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let raf = 0;

    const updateFromScroll = () => {
      raf = 0;
      const snapId = SNAP_ORDER[getNearestSnapIndex()];
      if (snapId !== "work-0" && snapId !== "work-1" && snapId !== "work-2") return;

      const targetIndex = projectIndexFromSnapId(snapId);
      if (targetIndex === scrollIndexRef.current) return;
      scrollIndexRef.current = targetIndex;
      setActiveIndex(targetIndex);
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(updateFromScroll);
    };

    updateFromScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const scrollToContact = useCallback(() => {
    scrollToSnap("contact", prefersReducedMotion ? "auto" : "smooth");
  }, [prefersReducedMotion]);

  const handleProjectClick = useCallback(() => {
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }
    scrollToContact();
  }, [scrollToContact]);

  const project = projects[activeIndex];

  const handleSwipeStart = (clientX: number, clientY: number) => {
    touchStartRef.current = { x: clientX, y: clientY };
  };

  const handleSwipeEnd = (clientX: number, clientY: number) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const dx = clientX - start.x;
    const dy = clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;

    didSwipeRef.current = true;
    if (dx < 0) {
      goToProject(scrollIndexRef.current + 1, { syncScroll: true });
    } else {
      goToProject(scrollIndexRef.current - 1, { syncScroll: true });
    }
  };

  return (
    <section
      ref={sectionRef}
      id="work"
      data-scroll-snap="work-0"
      className={`projects-scene snap-section-start${sectionInView ? " projects-in-view" : ""}`}
    >
      <div className="safe-area-x projects-pin section-surface sticky top-0 isolate grid h-[100dvh] max-h-[100dvh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <ViewportPhysicsBalls variant="projects" />
        <header className="projects-header projects-reveal projects-reveal--heading relative z-10 mx-auto w-full max-w-7xl shrink-0">
          <div className="projects-header-main">
            <h2 className="projects-heading font-display font-black uppercase tracking-tighter text-foreground">
              Projects
            </h2>
            <p className="projects-hint">
              Scroll to explore · Tap a project to contact us
            </p>
          </div>
          <p className="projects-description">
            Live dashboards, booking flows and automation tools built to reduce admin, missed
            bookings and messy operations.
          </p>
        </header>

        <div className="projects-stage projects-reveal projects-reveal--mockup relative z-10 mx-auto flex min-h-0 w-full max-w-7xl flex-col">
          <div
            role="button"
            tabIndex={0}
            aria-label={`Contact us about ${project.name}`}
            onClick={handleProjectClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                scrollToContact();
              }
            }}
            className="project-showcase-card group relative min-h-0 flex-1 cursor-pointer overflow-hidden rounded-2xl border sm:rounded-3xl"
            onTouchStart={(e) => {
              const t = e.touches[0];
              if (t) handleSwipeStart(t.clientX, t.clientY);
            }}
            onTouchEnd={(e) => {
              const t = e.changedTouches[0];
              if (t) handleSwipeEnd(t.clientX, t.clientY);
            }}
          >
            <ProjectShowcaseSlider
              ref={sliderRef}
              slides={projects}
              activeIndex={activeIndex}
              className="absolute inset-0 overflow-hidden rounded-[inherit]"
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/60 to-transparent p-3 pt-14 sm:p-8 sm:pt-24 lg:p-10">
              <div key={`meta-${activeIndex}`} className="project-meta-fade">
                <div className="mb-2 flex items-center justify-between gap-2 sm:mb-4 sm:gap-3">
                  <div className="font-mono text-[10px] tracking-[0.18em] text-text-soft sm:text-sm sm:tracking-[0.2em]">
                    {String(activeIndex + 1).padStart(2, "0")} /{" "}
                    {String(projects.length).padStart(2, "0")}
                  </div>
                  <span className="max-w-[56%] truncate rounded-full border border-glass bg-glass-bg px-2 py-0.5 text-[8px] font-medium uppercase tracking-[0.14em] text-foreground backdrop-blur sm:max-w-none sm:px-3 sm:py-1 sm:text-xs sm:tracking-[0.18em]">
                    {project.tag}
                  </span>
                </div>

                <div className="flex items-end justify-between gap-2 sm:gap-4">
                  <h3 className="project-showcase-title min-w-0 font-display font-black tracking-tight text-foreground">
                    {project.name}
                  </h3>
                  <span className="flex shrink-0 flex-col items-center gap-1 text-brand-cyan transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowUpRight className="h-6 w-6 sm:h-8 sm:w-8" aria-hidden />
                    <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-text-soft sm:text-[9px]">
                      Contact
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="safe-area-bottom projects-dots mx-auto mt-3 flex items-center justify-center gap-1.5 sm:mt-4 lg:hidden">
            {projects.map((item, index) => (
              <button
                key={item.name}
                type="button"
                aria-label={`View ${item.name}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  goToProject(index, { syncScroll: true });
                }}
                className="touch-target flex items-center justify-center"
              >
                <span
                  className={`projects-dot block rounded-full transition ${
                    index === activeIndex ? "projects-dot--active" : ""
                  }`}
                />
              </button>
            ))}
          </div>

          {coarsePointer && (
            <p className="projects-swipe-hint mt-1.5 text-center lg:hidden">
              Swipe or tap · Scroll to explore
            </p>
          )}

          <ProjectValueCards
            activeIndex={activeIndex}
            onSelect={(index) => goToProject(index, { syncScroll: true })}
          />

          <div className="projects-dots-rail absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 flex-col gap-3.5 lg:flex">
            {projects.map((item, index) => (
              <button
                key={item.name}
                type="button"
                aria-label={`View ${item.name}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  goToProject(index, { syncScroll: true });
                }}
                className={`projects-dot-rail touch-target flex items-center justify-center ${
                  index === activeIndex ? "projects-dot-rail--active" : ""
                }`}
              >
                <span className="projects-dot block rounded-full" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {projects.slice(1).map((_, index) => (
        <div
          key={index}
          data-scroll-snap={`work-${index + 1}`}
          className="projects-scroll-snap"
          aria-hidden
        />
      ))}
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
  useScrollChoreography();

  return (
    <main className="scroll-snap-canvas min-h-[100dvh] bg-background font-sans text-foreground">
      <Hero />
      <WhatWeBuildSection />
      <WhoThisIsForSection />
      <PricingDirectionSection />
      <Projects />
      <FinalCtaSection />
      <Contact />
    </main>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useRef, useState, useCallback, useEffect } from "react";
import { useDeviceProfile } from "@/hooks/use-device-profile";
import solupairLogo from "@/assets/solupair-logo.png";
import solupairWordmark from "@/assets/solupair-wordmark.png";
import { HeroFaceBall } from "@/components/hero-face-ball";
import { ViewportPhysicsBalls } from "@/components/viewport-physics-balls";
import { ProjectShowcaseSlider, type ShowcaseSliderHandle } from "@/components/project-showcase-slider";
import { PROJECT_SHOWCASES } from "@/components/project-showcases";
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
      className="site-logo inline-flex min-w-0 shrink-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3 lg:gap-4"
      aria-label="Solupair"
    >
      <img
        src={solupairLogo}
        alt=""
        aria-hidden
        width={1536}
        height={1206}
        decoding="async"
        className="site-logo-mark h-[3.25rem] w-auto shrink-0 object-contain object-left sm:h-[4rem] lg:h-[4.5rem]"
      />
      <div className="min-w-0">
        <div className="h-[1.35rem] overflow-hidden sm:h-[1.65rem] lg:h-[1.85rem]">
          <img
            src={solupairWordmark}
            alt="Solupair"
            width={1600}
            height={153}
            decoding="async"
            className="h-full w-auto max-w-[min(52vw,16rem)] object-contain object-left object-top sm:max-w-[min(44vw,20rem)] lg:max-w-[14rem] xl:max-w-none"
          />
        </div>
        <p className="site-logo-tagline hidden md:block">
          Digital systems that push businesses forward
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
          <circle cx="380" cy="460" r="2.5" fill="var(--accent-lime)" opacity="0.55" />
          <circle cx="680" cy="500" r="2" fill="var(--brand-cyan)" opacity="0.4" />
          <circle cx="1040" cy="340" r="2.5" fill="var(--accent-lime)" opacity="0.45" />
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
                <span className="site-nav-label site-nav-label--short">Work</span>
                <span className="site-nav-label site-nav-label--full">Our work</span>
              </a>
              <a href="#contact" className="site-nav-link site-nav-link--primary">
                <span className="site-nav-label site-nav-label--short">Contact</span>
                <span className="site-nav-label site-nav-label--full">Get in touch</span>
              </a>
            </nav>
          </div>
        </div>
      </header>

      <div className="hero-content relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 pb-8 pt-2 sm:px-8 sm:pb-10 lg:px-10">
        <div className="hero-reveal hero-reveal--eyebrow mb-3 flex justify-center sm:mb-4">
          <p className="hero-eyebrow">
            <span className="hero-eyebrow-dot" aria-hidden />
            Automation &amp; web design
          </p>
        </div>

        <div className="hero-stage relative w-full max-w-[100vw] text-center">
          <svg
            className="hero-connectors"
            viewBox="0 0 800 320"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="heroConnectorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--brand-cyan)" stopOpacity="0.15" />
                <stop offset="50%" stopColor="var(--brand-cyan)" stopOpacity="0.55" />
                <stop offset="100%" stopColor="var(--brand-pink)" stopOpacity="0.15" />
              </linearGradient>
            </defs>
            <path
              d="M40 200 H220 L280 140 H520"
              fill="none"
              stroke="url(#heroConnectorGrad)"
              strokeWidth="1"
            />
            <path
              d="M760 120 H580 L520 180 H280"
              fill="none"
              stroke="url(#heroConnectorGrad)"
              strokeWidth="1"
            />
            <circle cx="280" cy="140" r="2.5" fill="var(--accent-lime)" opacity="0.65" />
            <circle cx="520" cy="180" r="2" fill="var(--brand-cyan)" opacity="0.5" />
          </svg>

          <div className="hero-headline-orb" aria-hidden />

          <h1
            className="hero-reveal hero-reveal--headline-a hero-headline relative z-[1] w-full break-words px-1 font-display font-black leading-[0.88] tracking-tighter sm:whitespace-nowrap sm:leading-[0.86] sm:px-0"
            style={{ fontSize: "clamp(2.5rem, 10.5vw, 13rem)" }}
          >
            WE DESIGN
          </h1>
          <h1
            className="hero-reveal hero-reveal--headline-b hero-headline relative z-[1] w-full break-words px-1 font-display font-black leading-[0.88] tracking-tighter sm:whitespace-nowrap sm:leading-[0.86] sm:px-0"
            style={{ fontSize: "clamp(2.5rem, 10.5vw, 13rem)" }}
          >
            <span className="relative inline-block">
              THE FUTURE
              <span className="hero-headline-accent" aria-hidden />
            </span>
          </h1>

          <p className="hero-reveal hero-reveal--microline hero-microline relative z-[1]">
            Systems<span className="hero-microline-sep" aria-hidden>·</span>
            Automations<span className="hero-microline-sep" aria-hidden>·</span>
            Interfaces<span className="hero-microline-sep" aria-hidden>·</span>
            Momentum
          </p>
        </div>

        <p className="hero-reveal hero-reveal--subheading hero-subheading mt-5 px-2 text-center sm:mt-6">
          Web applications, dashboards, WhatsApp booking agents and business automation systems
          built to move faster than your competitors.
        </p>

        <div className="hero-reveal hero-reveal--ctas hero-ctas mt-7 sm:mt-8">
          <a href="#contact" className="hero-btn hero-btn--primary">
            <span>Get in touch</span>
          </a>
          <a href="#work" className="hero-btn hero-btn--secondary">
            Our work
          </a>
        </div>

        <p className="hero-reveal hero-reveal--tagline site-logo-tagline mt-6 text-center md:hidden">
          Digital systems that push businesses forward
        </p>
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
      className="projects-scene snap-section-start"
    >
      <div className="safe-area-x projects-pin section-surface sticky top-0 isolate grid h-[100dvh] max-h-[100dvh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden py-4 sm:py-8 lg:py-10">
        <ViewportPhysicsBalls variant="projects" />
        <div className="relative z-10 mx-auto flex w-full max-w-7xl shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div>
            <h2
              className="font-display font-black uppercase leading-[0.9] tracking-tighter text-foreground"
              style={{ fontSize: "clamp(2.25rem, 11vw, 9rem)" }}
            >
              Projects
            </h2>
            <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.28em] text-text-dim sm:mt-3 sm:text-[11px]">
              Scroll to explore · Tap a project to contact us
            </p>
          </div>
          <p className="hidden max-w-sm text-right text-xs tracking-[0.2em] text-text-soft sm:block sm:text-sm">
            WEBSITES WITH MOTION · LIVE DASHBOARDS · WHATSAPP BOOKING AGENTS — BUILT CLEAN &amp; PREMIUM.
          </p>
        </div>

        <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-7xl flex-col px-0 sm:px-0">
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

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/60 to-transparent p-4 pt-16 sm:p-8 sm:pt-24 lg:p-10">
              <div key={`meta-${activeIndex}`} className="project-meta-fade">
                <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
                  <div className="font-mono text-[11px] tracking-[0.2em] text-text-soft sm:text-sm">
                    {String(activeIndex + 1).padStart(2, "0")} /{" "}
                    {String(projects.length).padStart(2, "0")}
                  </div>
                  <span className="max-w-[58%] truncate rounded-full border border-glass bg-glass-bg px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.16em] text-foreground backdrop-blur sm:max-w-none sm:px-3 sm:text-xs sm:tracking-[0.18em]">
                    {project.tag}
                  </span>
                </div>

                <div className="flex items-end justify-between gap-3 sm:gap-4">
                  <h3 className="min-w-0 font-display text-2xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
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

          <div className="safe-area-bottom mx-auto mt-2 flex items-center justify-center gap-1 sm:mt-3 lg:hidden">
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
                  className={`block rounded-full border border-glass transition ${
                    index === activeIndex
                      ? "h-3 w-3 bg-foreground opacity-100 sm:h-3.5 sm:w-3.5"
                      : "h-2.5 w-2.5 bg-muted-foreground opacity-40 sm:h-3 sm:w-3"
                  }`}
                />
              </button>
            ))}
          </div>

          {coarsePointer && (
            <p className="mt-1 text-center text-[9px] uppercase tracking-[0.2em] text-text-dim lg:hidden">
              Swipe or tap · Scroll to explore
            </p>
          )}

          <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 flex-col gap-4 lg:flex">
            {projects.map((item, index) => (
              <button
                key={item.name}
                type="button"
                aria-label={`View ${item.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  goToProject(index, { syncScroll: true });
                }}
                className={`relative h-3.5 w-3.5 rounded-full border border-glass transition ${
                  index === activeIndex
                    ? "scale-100 bg-foreground opacity-100"
                    : "scale-90 bg-muted-foreground opacity-35 hover:opacity-70"
                }`}
              />
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
  return (
    <section
      id="contact"
      data-scroll-snap="contact"
      className="safe-area-x section-surface snap-section-panel relative isolate flex min-h-[100dvh] flex-col justify-center px-4 py-16 sm:px-10 sm:py-24 lg:px-14 lg:py-32"
    >
      <ViewportPhysicsBalls variant="contact" />
      <div className="relative z-10 mx-auto max-w-7xl border-t border-subtle pt-10 sm:pt-16">
        <div className="grid grid-cols-1 gap-10 sm:gap-12 lg:grid-cols-2">
          <div>
            <h2
              className="font-display font-black uppercase leading-[0.9] tracking-tighter text-foreground"
              style={{ fontSize: "clamp(2rem, 10vw, 7rem)" }}
            >
              Let's Talk
            </h2>
            <p className="mt-4 max-w-md text-xs uppercase leading-relaxed tracking-[0.16em] text-text-soft sm:mt-6 sm:text-sm sm:tracking-[0.18em]">
              Got a project in mind? We'd love to hear about it. Drop us a line and let's create something extraordinary.
            </p>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="mt-8 max-w-md space-y-5 sm:mt-10 sm:space-y-6"
            >
              <input
                placeholder="YOUR NAME"
                className="contact-form-input mobile-input w-full border-b bg-transparent py-3 text-base tracking-wider sm:text-sm"
              />
              <input
                type="email"
                placeholder="YOUR EMAIL"
                className="contact-form-input mobile-input w-full border-b bg-transparent py-3 text-base tracking-wider sm:text-sm"
              />
              <textarea
                rows={3}
                placeholder="Tell us about your project"
                className="contact-form-input mobile-input w-full resize-none border-b bg-transparent py-3 text-base tracking-wider sm:text-sm"
              />
              <button type="submit" className="contact-submit-btn touch-target">
                Send Message <ArrowUpRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          <div className="lg:pl-12">
            <div className="space-y-5 sm:space-y-6">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-text-dim">Email</div>
                <a
                  href="mailto:info@solupair.co.za"
                  className="mt-1 block text-base text-foreground break-all transition hover:text-brand-cyan"
                >
                  info@solupair.co.za
                </a>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-text-dim">Location</div>
                <div className="mt-1 text-sm leading-relaxed text-text-soft sm:text-base">
                  South Africa · Johannesburg &amp; Cape Town · Remote-first
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="safe-area-bottom mt-12 flex flex-col items-start justify-between gap-3 border-t border-subtle pt-6 text-[10px] uppercase tracking-[0.18em] text-text-dim sm:mt-20 sm:flex-row sm:items-center sm:gap-4 sm:text-[11px] sm:tracking-[0.2em]">
          <div>© 2026 Solupair Pty Ltd. All rights reserved.</div>
          <div className="flex gap-6">
            <a href="#" className="touch-target transition hover:text-brand-cyan">Privacy</a>
            <a href="#" className="touch-target transition hover:text-brand-cyan">Terms</a>
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
      <Projects />
      <Contact />
    </main>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useRef, useState, useCallback } from "react";
import { getViewportHeight, useDeviceProfile } from "@/hooks/use-device-profile";
import solupairLogo from "@/assets/solupair-logo.png";
import { ProjectShowcaseSlider, type ShowcaseSliderHandle } from "@/components/project-showcase-slider";
import { PROJECT_SHOWCASES } from "@/components/project-showcases";

export const Route = createFileRoute("/")({
  component: NovaHome,
});

const projects = PROJECT_SHOWCASES;

function SolupairLogo() {
  return (
    <a href="https://solupair.co.za" className="inline-flex items-center">
      <img
        src={solupairLogo}
        alt="Solupair"
        className="h-11 w-11 object-contain sm:h-14 sm:w-14"
      />
    </a>
  );
}

function FaceBall({ compact }: { compact?: boolean }) {
  const { scrollY } = useScroll();
  const { prefersReducedMotion } = useDeviceProfile();
  // Eyes: lids closed (scaleY 1) → open (0) as user begins to scroll
  const lidRaw = useTransform(scrollY, [0, 220], [1, 0]);
  const lidScale = useSpring(lidRaw, { stiffness: 140, damping: 22 });
  // Smile: 0 (neutral dot) → 1 (full grin) as scroll continues
  const smileRaw = useTransform(scrollY, [180, 520], [0, 1]);
  const smile = useSpring(smileRaw, { stiffness: 140, damping: 22 });
  const mouthWidth = useTransform(smile, (v: number) => `${22 + v * 70}px`);
  const mouthHeight = useTransform(smile, (v: number) => `${36 + v * 12}px`);
  const mouthRadius = useTransform(
    smile,
    (v: number) =>
      `${50 - v * 40}% ${50 - v * 40}% ${50 + v * 45}% ${50 + v * 45}% / ${50 - v * 35}% ${50 - v * 35}% ${50 + v * 55}% ${50 + v * 55}%`,
  );
  // Bounce amplitude grows from 8 → 34 px with scroll
  const bounceAmp = useTransform(scrollY, [0, 600], [8, 34]);
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 ${
        compact
          ? "h-[min(52vw,200px)] w-[min(52vw,200px)]"
          : "h-[min(68vw,280px)] w-[min(68vw,280px)] sm:h-[360px] sm:w-[360px] lg:h-[440px] lg:w-[440px]"
      }`}
    >
      <BouncingBall
        lidScale={lidScale}
        mouthRadius={mouthRadius}
        mouthHeight={mouthHeight}
        mouthWidth={mouthWidth}
        bounceAmp={bounceAmp}
        reducedMotion={prefersReducedMotion}
      />
    </div>
  );
}

type BallProps = {
  lidScale: MotionValue<number>;
  mouthRadius: MotionValue<string>;
  mouthHeight: MotionValue<string>;
  mouthWidth: MotionValue<string>;
  bounceAmp: MotionValue<number>;
  reducedMotion?: boolean;
};

function BouncingBall({
  lidScale,
  mouthRadius,
  mouthHeight,
  mouthWidth,
  bounceAmp,
  reducedMotion,
}: BallProps) {
  const ampPx = useTransform(bounceAmp, (v) => `${v}px`);
  return (
    <motion.div
      className={`h-full w-full ${reducedMotion ? "" : "animate-[novaBounce_2.8s_ease-in-out_infinite]"}`}
      style={reducedMotion ? undefined : { ["--nova-amp" as string]: ampPx }}
    >
      <div
        className="relative h-full w-full rounded-full"
        style={{
          background:
            "radial-gradient(circle at 32% 28%, oklch(0.72 0.18 275) 0%, oklch(0.48 0.26 275) 55%, oklch(0.32 0.22 275) 100%)",
          boxShadow:
            "inset -40px -50px 80px oklch(0 0 0 / 0.35), 0 40px 80px oklch(0 0 0 / 0.25)",
        }}
      >
        <Eye side="left" lidScale={lidScale} />
        <Eye side="right" lidScale={lidScale} />
        <motion.div
          className="absolute left-1/2 top-[64%] -translate-x-1/2 bg-black"
          style={{ width: mouthWidth, height: mouthHeight, borderRadius: mouthRadius }}
        />
      </div>
    </motion.div>
  );
}

function Eye({ side, lidScale }: { side: "left" | "right"; lidScale: MotionValue<number> }) {
  const posClass = side === "left" ? "left-[26%]" : "right-[26%]";
  return (
    <div className={`absolute ${posClass} top-[38%] h-[60px] w-[60px] sm:h-[80px] sm:w-[80px] lg:h-[100px] lg:w-[100px]`}>
      {/* open eye */}
      <div className="absolute inset-0 flex items-center justify-center text-[60px] leading-none text-black sm:text-[80px] lg:text-[100px]">✻</div>
      {/* lid that scales down to reveal eye */}
      <motion.div
        className="absolute inset-0 origin-center rounded-full"
        style={{
          scaleY: lidScale,
          background:
            "radial-gradient(circle at 32% 28%, oklch(0.72 0.18 275) 0%, oklch(0.48 0.26 275) 55%, oklch(0.32 0.22 275) 100%)",
        }}
      />
    </div>
  );
}

function Hero() {
  const { isPhone } = useDeviceProfile();

  return (
    <section className="safe-area-x relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <header className="safe-area-top relative z-20 flex items-center justify-between gap-3 px-4 py-4 sm:px-10 sm:py-6 lg:px-14">
        <SolupairLogo />
        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <a
            href="#work"
            className="touch-target rounded-full border border-white/30 px-3 py-2 text-[10px] font-semibold tracking-wider text-foreground transition hover:border-primary hover:text-primary sm:px-5 sm:text-sm"
          >
            <span className="sm:hidden">WORK</span>
            <span className="hidden sm:inline">OUR WORK</span>
          </a>
          <a
            href="#contact"
            className="touch-target rounded-full border border-white/30 px-3 py-2 text-[10px] font-semibold tracking-wider text-foreground transition hover:border-primary hover:text-primary sm:px-5 sm:text-sm"
          >
            <span className="sm:hidden">CONTACT</span>
            <span className="hidden sm:inline">GET IN TOUCH</span>
          </a>
        </nav>
      </header>

      <div className="relative flex min-h-[calc(100dvh-4.5rem)] flex-col items-center justify-center px-4 pb-8 pt-2 sm:min-h-[calc(100dvh-6rem)] sm:px-6">
        <div className="relative z-0 mb-3 text-center text-[10px] font-medium tracking-[0.22em] text-primary sm:mb-4 sm:text-sm sm:tracking-[0.3em]">
          AUTOMATION &amp; WEB DESIGN
        </div>

        <div className="relative w-full max-w-[100vw]">
          <FaceBall compact={isPhone} />
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative z-0 w-full break-words px-1 text-center font-display font-black leading-[0.88] tracking-tighter text-foreground sm:whitespace-nowrap sm:leading-[0.85] sm:px-0"
            style={{ fontSize: "clamp(2.75rem, 13.5vw, 18rem)" }}
          >
            WE DESIGN
          </motion.h1>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="relative z-0 w-full break-words px-1 text-center font-display font-black leading-[0.88] tracking-tighter text-primary sm:whitespace-nowrap sm:leading-[0.85] sm:px-0"
            style={{ fontSize: "clamp(2.75rem, 13.5vw, 18rem)" }}
          >
            THE FUTURE
          </motion.h1>
        </div>

        <p className="mt-6 max-w-xl px-2 text-center text-[10px] leading-relaxed tracking-[0.14em] text-foreground/70 sm:mt-10 sm:max-w-2xl sm:text-xs sm:tracking-[0.2em]">
          WEB APPLICATIONS, DASHBOARDS, WHATSAPP BOOKING AGENTS — AND PLENTY MORE BUSINESS SOLUTIONS
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
  const { isPhone, isTablet, prefersReducedMotion, coarsePointer } = useDeviceProfile();

  const stepVh = isPhone ? 100 : isTablet ? 72 : 55;
  const sectionHeightVh = (projects.length - 1) * stepVh + (isPhone ? 140 : isTablet ? 115 : 100);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const goToProject = useCallback((index: number, options?: { syncScroll?: boolean }) => {
    const clamped = Math.min(projects.length - 1, Math.max(0, index));
    scrollIndexRef.current = clamped;
    setActiveIndex(clamped);

    if (options?.syncScroll && sectionRef.current) {
      const el = sectionRef.current;
      const sectionTop = window.scrollY + el.getBoundingClientRect().top;
      const viewportHeight = getViewportHeight();
      const scrollable = Math.max(0, el.offsetHeight - viewportHeight);
      const segments = Math.max(1, projects.length - 1);
      const progress = clamped / segments;
      window.scrollTo({
        top: sectionTop + scrollable * progress,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    }
  }, [prefersReducedMotion]);

  const scrollToContact = useCallback(() => {
    document.getElementById("contact")?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [prefersReducedMotion]);

  const handleProjectClick = useCallback(() => {
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }
    scrollToContact();
  }, [scrollToContact]);

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const segments = projects.length - 1;
    const scaled = progress * segments;
    const targetIndex = Math.min(
      projects.length - 1,
      Math.max(0, Math.round(scaled)),
    );

    if (targetIndex === scrollIndexRef.current) return;
    goToProject(targetIndex);
  });

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
      className="relative"
      style={{ height: `${sectionHeightVh}dvh` }}
    >
      <div
        className="safe-area-x sticky top-0 grid h-[100dvh] max-h-[100dvh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden py-4 sm:py-8 lg:py-10"
        style={{ background: "var(--section-dark)" }}
      >
        <div className="mx-auto flex w-full max-w-7xl shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div>
            <h2
              className="font-display font-black uppercase leading-[0.9] tracking-tighter text-foreground"
              style={{ fontSize: "clamp(2.25rem, 11vw, 9rem)" }}
            >
              Projects
            </h2>
            <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.28em] text-foreground/45 sm:mt-3 sm:text-[11px]">
              Scroll to explore · Tap a project to contact us
            </p>
          </div>
          <p className="hidden max-w-sm text-right text-xs tracking-[0.2em] text-foreground/70 sm:block sm:text-sm">
            WEBSITES WITH MOTION · LIVE DASHBOARDS · WHATSAPP BOOKING AGENTS — BUILT CLEAN &amp; PREMIUM.
          </p>
        </div>

        <div className="relative mx-auto flex min-h-0 w-full max-w-7xl flex-col px-0 sm:px-0">
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
            className="group relative min-h-0 flex-1 cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[0_24px_80px_oklch(0_0_0_/_0.45)] transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:rounded-3xl sm:shadow-[0_40px_120px_oklch(0_0_0_/_0.45)]"
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
              <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={`counter-${activeIndex}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                    className="font-mono text-[11px] tracking-[0.2em] text-white/70 sm:text-sm"
                  >
                    {String(activeIndex + 1).padStart(2, "0")} /{" "}
                    {String(projects.length).padStart(2, "0")}
                  </motion.div>
                </AnimatePresence>

                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={`tag-${activeIndex}`}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                    className="max-w-[58%] truncate rounded-full border border-white/15 bg-black/50 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.16em] text-white/90 backdrop-blur sm:max-w-none sm:px-3 sm:text-xs sm:tracking-[0.18em]"
                  >
                    {project.tag}
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="flex items-end justify-between gap-3 sm:gap-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.h3
                    key={`title-${activeIndex}`}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="min-w-0 font-display text-2xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl"
                  >
                    {project.name}
                  </motion.h3>
                </AnimatePresence>

                <span className="flex shrink-0 flex-col items-center gap-1 text-primary transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight className="h-6 w-6 sm:h-8 sm:w-8" aria-hidden />
                  <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/70 sm:text-[9px]">
                    Contact
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Mobile + tablet: 44px touch targets */}
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
                  className={`block rounded-full border border-white/25 transition ${
                    index === activeIndex
                      ? "h-3 w-3 bg-white opacity-100 sm:h-3.5 sm:w-3.5"
                      : "h-2.5 w-2.5 bg-white/30 opacity-40 sm:h-3 sm:w-3"
                  }`}
                />
              </button>
            ))}
          </div>

          {coarsePointer && (
            <p className="mt-1 text-center text-[9px] uppercase tracking-[0.2em] text-foreground/35 lg:hidden">
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
                className={`relative h-3.5 w-3.5 rounded-full border border-white/20 transition ${
                  index === activeIndex
                    ? "scale-100 bg-white opacity-100"
                    : "scale-90 bg-white/30 opacity-35 hover:opacity-70"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section
      id="contact"
      className="safe-area-x px-4 py-16 sm:px-10 sm:py-24 lg:px-14 lg:py-32"
      style={{ background: "var(--section-dark)" }}
    >
      <div className="mx-auto max-w-7xl border-t border-white/10 pt-10 sm:pt-16">
        <div className="grid grid-cols-1 gap-10 sm:gap-12 lg:grid-cols-2">
          <div>
            <h2
              className="font-display font-black uppercase leading-[0.9] tracking-tighter text-foreground"
              style={{ fontSize: "clamp(2rem, 10vw, 7rem)" }}
            >
              Let's Talk
            </h2>
            <p className="mt-4 max-w-md text-xs uppercase leading-relaxed tracking-[0.16em] text-foreground/70 sm:mt-6 sm:text-sm sm:tracking-[0.18em]">
              Got a project in mind? We'd love to hear about it. Drop us a line and let's create something extraordinary.
            </p>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="mt-8 max-w-md space-y-5 sm:mt-10 sm:space-y-6"
            >
              <input
                placeholder="YOUR NAME"
                className="mobile-input w-full border-b border-white/20 bg-transparent py-3 text-base tracking-wider text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none sm:text-sm"
              />
              <input
                type="email"
                placeholder="YOUR EMAIL"
                className="mobile-input w-full border-b border-white/20 bg-transparent py-3 text-base tracking-wider text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none sm:text-sm"
              />
              <textarea
                rows={3}
                placeholder="Tell us about your project"
                className="mobile-input w-full resize-none border-b border-white/20 bg-transparent py-3 text-base tracking-wider text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none sm:text-sm"
              />
              <button
                type="submit"
                className="touch-target inline-flex items-center gap-2 rounded-full border border-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-primary transition hover:bg-primary hover:text-primary-foreground"
              >
                Send Message <ArrowUpRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          <div className="lg:pl-12">
            <div className="space-y-5 sm:space-y-6">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground/60">Email</div>
                <a
                  href="mailto:info@solupair.co.za"
                  className="mt-1 block text-base text-foreground break-all hover:text-primary"
                >
                  info@solupair.co.za
                </a>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground/60">Location</div>
                <div className="mt-1 text-sm leading-relaxed text-foreground sm:text-base">
                  South Africa · Johannesburg &amp; Cape Town · Remote-first
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="safe-area-bottom mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-[10px] uppercase tracking-[0.18em] text-foreground/60 sm:mt-20 sm:flex-row sm:items-center sm:gap-4 sm:text-[11px] sm:tracking-[0.2em]">
          <div>© 2026 Solupair Pty Ltd. All rights reserved.</div>
          <div className="flex gap-6">
            <a href="#" className="touch-target hover:text-primary">Privacy</a>
            <a href="#" className="touch-target hover:text-primary">Terms</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function NovaHome() {
  return (
    <main className="min-h-[100dvh] bg-background font-sans text-foreground">
      <Hero />
      <Projects />
      <Contact />
    </main>
  );
}
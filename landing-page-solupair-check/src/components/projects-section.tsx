import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ProjectShowcaseSlider,
  type ShowcaseCarouselState,
  type ShowcaseSliderHandle,
} from "@/components/project-showcase-slider";
import { PROJECT_SHOWCASES } from "@/components/project-showcases";
import { ProjectValueCards } from "@/components/project-value-cards";
import { useDeviceProfile } from "@/hooks/use-device-profile";

const REVEAL_EASE = [0.22, 1, 0.36, 1] as const;
const projects = PROJECT_SHOWCASES;

function scrollToContact(prefersReducedMotion: boolean) {
  document.getElementById("contact")?.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "start",
  });
}

function revealProps(
  reduceMotion: boolean,
  inView: boolean,
  delay = 0,
  withScale = false,
) {
  if (reduceMotion) {
    return { initial: false as const, animate: undefined, transition: undefined };
  }

  return {
    initial: { opacity: 0, y: 24, ...(withScale ? { scale: 0.98 } : {}) },
    animate: inView
      ? { opacity: 1, y: 0, ...(withScale ? { scale: 1 } : {}) }
      : { opacity: 0, y: 24, ...(withScale ? { scale: 0.98 } : {}) },
    transition: { duration: withScale ? 0.85 : 0.72, ease: REVEAL_EASE, delay },
  };
}

export function ProjectsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const carouselRegionRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<ShowcaseSliderHandle>(null);
  const [carousel, setCarousel] = useState<ShowcaseCarouselState>({
    index: 0,
    canScrollPrev: false,
    canScrollNext: projects.length > 1,
  });
  const [sectionInView, setSectionInView] = useState(false);
  const [sectionActive, setSectionActive] = useState(false);
  const { prefersReducedMotion } = useDeviceProfile();
  const reduceMotion = useReducedMotion() || prefersReducedMotion;

  const project = projects[carousel.index];

  const syncCarousel = useCallback((state: ShowcaseCarouselState) => {
    setCarousel(state);
  }, []);

  const goToProject = useCallback((index: number) => {
    sliderRef.current?.scrollTo(index);
  }, []);

  const scrollPrev = useCallback(() => {
    sliderRef.current?.scrollPrev();
  }, []);

  const scrollNext = useCallback(() => {
    sliderRef.current?.scrollNext();
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    if (reduceMotion) {
      setSectionInView(true);
      setSectionActive(true);
      return;
    }

    const revealObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setSectionInView(true);
        revealObserver.disconnect();
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
    );

    const activeObserver = new IntersectionObserver(
      ([entry]) => {
        setSectionActive(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    revealObserver.observe(section);
    activeObserver.observe(section);

    return () => {
      revealObserver.disconnect();
      activeObserver.disconnect();
    };
  }, [reduceMotion]);

  const handleCarouselKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          scrollPrev();
          break;
        case "ArrowRight":
          event.preventDefault();
          scrollNext();
          break;
        case "Home":
          event.preventDefault();
          goToProject(0);
          break;
        case "End":
          event.preventDefault();
          goToProject(projects.length - 1);
          break;
        default:
          break;
      }
    },
    [goToProject, scrollNext, scrollPrev],
  );

  return (
    <section
      ref={sectionRef}
      id="work"
      data-scroll-snap="work"
      aria-labelledby="projects-heading"
      className={`projects-section safe-area-x section-surface relative isolate overflow-x-clip px-4 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-24${sectionInView ? " projects-in-view" : ""}${sectionActive ? " projects-section--active" : ""}`}
    >
      <div className="projects-glow projects-glow--cyan" aria-hidden />
      <div className="projects-glow projects-glow--magenta" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <header className="projects-header">
          <div className="projects-header-main">
            <motion.h2
              id="projects-heading"
              className="projects-heading font-display font-black uppercase tracking-tighter text-foreground"
              {...revealProps(reduceMotion, sectionInView, 0.02)}
            >
              Projects
            </motion.h2>
            <motion.p
              className="projects-hint"
              {...revealProps(reduceMotion, sectionInView, 0.1)}
            >
              Swipe, click or tap through selected builds.
            </motion.p>
          </div>
          <motion.p
            className="projects-description"
            {...revealProps(reduceMotion, sectionInView, 0.18)}
          >
            Live dashboards, booking flows and automation tools built to reduce admin, missed
            bookings and messy operations.
          </motion.p>
        </header>

        <motion.div className="projects-stage" {...revealProps(reduceMotion, sectionInView, 0.26, true)}>
          <div className="projects-showcase-shell">
            <div
              ref={carouselRegionRef}
              className="projects-carousel-region"
              role="region"
              aria-roledescription="carousel"
              aria-label="Selected project builds"
              tabIndex={0}
              onKeyDown={handleCarouselKeyDown}
            >
              <div className="project-showcase-card relative overflow-hidden rounded-2xl border sm:rounded-3xl">
                <ProjectShowcaseSlider
                  ref={sliderRef}
                  slides={projects}
                  onSelect={syncCarousel}
                  className="relative z-0"
                />

                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
                  aria-hidden
                />

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-16 sm:p-8 sm:pt-24 lg:p-10">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={project.id}
                      className="pointer-events-auto"
                      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.5, ease: REVEAL_EASE }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2 sm:mb-4 sm:gap-3">
                        <div className="font-mono text-[10px] tracking-[0.18em] text-text-soft sm:text-sm sm:tracking-[0.2em]">
                          {String(carousel.index + 1).padStart(2, "0")} /{" "}
                          {String(projects.length).padStart(2, "0")}
                        </div>
                        <span className="max-w-[56%] truncate rounded-full border border-glass bg-glass-bg px-2 py-0.5 text-[8px] font-medium uppercase tracking-[0.14em] text-foreground backdrop-blur sm:max-w-none sm:px-3 sm:py-1 sm:text-xs sm:tracking-[0.18em]">
                          {project.tag}
                        </span>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                        <h3 className="project-showcase-title min-w-0 font-display font-black tracking-tight text-foreground">
                          {project.name}
                        </h3>
                        <a
                          href="#contact"
                          onClick={(e) => {
                            e.preventDefault();
                            scrollToContact(reduceMotion);
                          }}
                          className="projects-contact-cta hero-btn hero-btn--secondary touch-target inline-flex shrink-0 self-start sm:self-auto"
                        >
                          <span>Discuss this build</span>
                          <ArrowUpRight className="size-4" aria-hidden />
                        </a>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div
              className="projects-dots-rail hidden flex-col gap-3.5 lg:flex"
              role="tablist"
              aria-label="Project slides"
            >
              {projects.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-label={`Show ${item.cardTitle} project`}
                  aria-selected={index === carousel.index}
                  aria-controls="projects-carousel-panel"
                  onClick={() => goToProject(index)}
                  className={`projects-dot-rail touch-target flex items-center justify-center ${
                    index === carousel.index ? "projects-dot-rail--active" : ""
                  }`}
                >
                  <span className="projects-dot block rounded-full" />
                </button>
              ))}
            </div>
          </div>

          <div className="projects-carousel-controls safe-area-bottom mt-4 flex items-center justify-center gap-3 sm:mt-5">
            <button
              type="button"
              className="projects-carousel-arrow touch-target"
              aria-label="Previous project"
              disabled={!carousel.canScrollPrev}
              onClick={scrollPrev}
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>

            <div
              id="projects-carousel-panel"
              className="projects-dots flex items-center justify-center gap-1.5"
              role="tablist"
              aria-label="Project slides"
            >
              {projects.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-label={`Show ${item.cardTitle} project`}
                  aria-selected={index === carousel.index}
                  onClick={() => goToProject(index)}
                  className="touch-target flex items-center justify-center"
                >
                  <span
                    className={`projects-dot block rounded-full transition ${
                      index === carousel.index ? "projects-dot--active" : ""
                    }`}
                  />
                </button>
              ))}
            </div>

            <button
              type="button"
              className="projects-carousel-arrow touch-target"
              aria-label="Next project"
              disabled={!carousel.canScrollNext}
              onClick={scrollNext}
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>

          <ProjectValueCards activeIndex={carousel.index} onSelect={goToProject} />
        </motion.div>
      </div>
    </section>
  );
}

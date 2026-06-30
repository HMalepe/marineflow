import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useSectionInView } from "@/hooks/use-section-in-view";
import { useDeviceProfile } from "@/hooks/use-device-profile";
import { WHAT_WE_BUILD_CAPABILITIES, WHAT_WE_BUILD_SPINE } from "@/lib/what-we-build-capabilities";
import { navigateToSection } from "@/lib/section-nav";

const REVEAL_EASE = [0.22, 1, 0.36, 1] as const;

function revealProps(
  reduceMotion: boolean,
  inView: boolean,
  delay = 0,
) {
  if (reduceMotion) {
    return { initial: false as const, animate: undefined, transition: undefined };
  }

  return {
    initial: { opacity: 0, y: 20 },
    animate: inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 },
    transition: { duration: 0.72, ease: REVEAL_EASE, delay },
  };
}

export function WhatWeBuildSection() {
  const { sectionRef, sectionInView } = useSectionInView({ threshold: 0.12 });
  const { prefersReducedMotion } = useDeviceProfile();
  const reduceMotion = useReducedMotion() || prefersReducedMotion;

  return (
    <section
      ref={sectionRef}
      id="services"
      data-scroll-snap="services"
      aria-labelledby="services-heading"
      className="what-we-build safe-area-x section-surface snap-section-flow relative isolate overflow-x-clip px-4 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-28 lg:pb-32"
    >
      <div className="what-we-build-glow what-we-build-glow--left" aria-hidden />
      <div className="what-we-build-glow what-we-build-glow--right" aria-hidden />
      <div className="what-we-build-grid-bg" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <div className="what-we-build-layout">
          <header className="what-we-build-intro">
            <motion.h2
              id="services-heading"
              className="what-we-build-heading font-display font-black uppercase tracking-tighter text-foreground"
              {...revealProps(reduceMotion, sectionInView, 0.04)}
            >
              {WHAT_WE_BUILD_SPINE.headline}
            </motion.h2>
            <motion.p
              className="what-we-build-lead"
              {...revealProps(reduceMotion, sectionInView, 0.12)}
            >
              {WHAT_WE_BUILD_SPINE.lead}
            </motion.p>
            <motion.p
              className="what-we-build-path"
              {...revealProps(reduceMotion, sectionInView, 0.18)}
            >
              {WHAT_WE_BUILD_SPINE.path}
            </motion.p>
            <motion.div {...revealProps(reduceMotion, sectionInView, 0.24)}>
              <a
                href="#work"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToSection("work", reduceMotion);
                }}
                className="what-we-build-cta touch-target"
              >
                <span>See selected builds</span>
                <ArrowUpRight className="size-4" aria-hidden />
              </a>
            </motion.div>
          </header>

          <div className="what-we-build-capabilities">
            <div className="what-we-build-rail" aria-hidden>
              <span className="what-we-build-rail__line" />
              <span className="what-we-build-rail__glow" />
            </div>

            <ol className="what-we-build-rows" aria-label="Systems we build">
              {WHAT_WE_BUILD_CAPABILITIES.map((item, index) => (
                <motion.li
                  key={item.id}
                  className="what-we-build-rows__item"
                  {...revealProps(reduceMotion, sectionInView, 0.24 + index * 0.08)}
                >
                  <article
                    className={`what-we-build-row what-we-build-row--${item.accent}`}
                    tabIndex={0}
                  >
                    <div className="what-we-build-row__meta">
                      <span className="what-we-build-row__index">{item.index}</span>
                      <span className="what-we-build-row__tick" aria-hidden />
                    </div>
                    <div className="what-we-build-row__body">
                      <p className="what-we-build-row__category">{item.category}</p>
                      <h3 className="what-we-build-row__title">{item.title}</h3>
                      <p className="what-we-build-row__desc">{item.description}</p>
                    </div>
                  </article>
                </motion.li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

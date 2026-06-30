import { useEffect, useRef, useState } from "react";
import { useDeviceProfile } from "@/hooks/use-device-profile";

export function FinalCtaSection() {
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
      { threshold: 0.2, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  return (
    <section
      ref={sectionRef}
      id="final-cta"
      data-scroll-snap="cta"
      aria-labelledby="final-cta-heading"
      className={`final-cta safe-area-x section-surface snap-section-panel relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-20 sm:px-10 sm:py-24 lg:px-14 lg:py-28${sectionInView ? " final-cta-in-view" : ""}`}
    >
      <div className="final-cta-glow final-cta-glow--cyan" aria-hidden />
      <div className="final-cta-glow final-cta-glow--magenta" aria-hidden />
      <div className="final-cta-glow final-cta-glow--purple" aria-hidden />

      <div className="final-cta-content relative z-10 mx-auto w-full max-w-4xl text-center">
        <h2
          id="final-cta-heading"
          className="final-cta-question final-cta-reveal final-cta-reveal--question font-display font-black uppercase tracking-tighter text-foreground"
        >
          Have a messy business process?
        </h2>

        <p className="final-cta-answer final-cta-reveal final-cta-reveal--answer font-display font-black uppercase tracking-tighter">
          We can turn it into a{" "}
          <span className="final-cta-answer__accent">clean digital system.</span>
        </p>

        <p className="final-cta-support final-cta-reveal final-cta-reveal--support">
          From missed messages to manual spreadsheets, Solupair helps turn everyday operational
          friction into smooth digital workflows.
        </p>

        <div className="final-cta-actions final-cta-reveal final-cta-reveal--actions">
          <a href="#contact" className="final-cta-btn hero-btn hero-btn--primary touch-target">
            <span>Start with a quick message</span>
          </a>
          <a href="mailto:info@solupair.co.za" className="final-cta-email touch-target">
            Or email info@solupair.co.za
          </a>
        </div>
      </div>
    </section>
  );
}

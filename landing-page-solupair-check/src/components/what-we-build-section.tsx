import { useEffect, useRef, useState } from "react";
import { useDeviceProfile } from "@/hooks/use-device-profile";

const WHAT_WE_BUILD_ITEMS = [
  {
    id: "websites",
    title: "Websites that convert",
    description:
      "Premium landing pages for businesses that need trust, clarity and enquiries.",
    accent: "cyan",
  },
  {
    id: "dashboards",
    title: "Dashboards that reveal",
    description:
      "Operational dashboards for stock, bookings, staff, revenue and performance.",
    accent: "purple",
  },
  {
    id: "whatsapp",
    title: "WhatsApp flows that work",
    description:
      "Booking, reminders, loyalty, FAQs and customer support inside WhatsApp.",
    accent: "magenta",
  },
  {
    id: "automation",
    title: "Automation that removes admin",
    description:
      "Simple systems that reduce manual follow-ups, missed messages and repeated tasks.",
    accent: "purple",
  },
] as const;

export function WhatWeBuildSection() {
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
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  return (
    <section
      ref={sectionRef}
      id="services"
      data-scroll-snap="services"
      className={`what-we-build safe-area-x section-surface snap-section-panel relative isolate overflow-hidden px-4 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-28${sectionInView ? " what-we-build-in-view" : ""}`}
    >
      <div className="what-we-build-glow what-we-build-glow--left" aria-hidden />
      <div className="what-we-build-glow what-we-build-glow--right" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <header className="what-we-build-header">
          <h2 className="what-we-build-heading what-we-build-reveal what-we-build-reveal--heading font-display font-black uppercase tracking-tighter text-foreground">
            What we build
          </h2>
          <p className="what-we-build-subtitle what-we-build-reveal what-we-build-reveal--subtitle">
            Premium digital systems for businesses that need cleaner workflows, faster
            follow-ups and better visibility.
          </p>
        </header>

        <ul className="what-we-build-grid">
          {WHAT_WE_BUILD_ITEMS.map((item, index) => (
            <li key={item.id} className="what-we-build-grid__item">
              <article
                className={`what-we-build-card what-we-build-reveal what-we-build-reveal--card what-we-build-card--${item.accent}`}
                style={{ animationDelay: `${0.22 + index * 0.09}s` }}
              >
                <h3 className="what-we-build-card__title">{item.title}</h3>
                <p className="what-we-build-card__desc">{item.description}</p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

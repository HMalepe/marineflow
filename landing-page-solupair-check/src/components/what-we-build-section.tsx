import { useSectionInView } from "@/hooks/use-section-in-view";

const WHAT_WE_BUILD_ITEMS = [
  {
    id: "websites",
    label: "Websites",
    title: "Websites that convert",
    description:
      "Premium landing pages for businesses that need trust, clarity and enquiries.",
  },
  {
    id: "dashboards",
    label: "Dashboards",
    title: "Dashboards that reveal",
    description:
      "Operational dashboards for stock, bookings, staff, revenue and performance.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    title: "WhatsApp flows that work",
    description:
      "Booking, reminders, loyalty, FAQs and customer support inside WhatsApp.",
  },
  {
    id: "automation",
    label: "Automation",
    title: "Automation that removes admin",
    description:
      "Simple systems that reduce manual follow-ups, missed messages and repeated tasks.",
  },
] as const;

export function WhatWeBuildSection() {
  const { sectionRef, sectionInView } = useSectionInView({ threshold: 0.14 });

  return (
    <section
      ref={sectionRef}
      id="services"
      data-scroll-snap="services"
      aria-labelledby="services-heading"
      className={`what-we-build safe-area-x section-surface snap-section-flow relative isolate overflow-x-clip px-4 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-28${sectionInView ? " what-we-build-in-view" : ""}`}
    >
      <div className="what-we-build-glow what-we-build-glow--left" aria-hidden />
      <div className="what-we-build-glow what-we-build-glow--right" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <div className="what-we-build-layout">
          <header className="what-we-build-header">
            <h2
              id="services-heading"
              className="what-we-build-heading what-we-build-reveal what-we-build-reveal--heading font-display font-black uppercase tracking-tighter text-foreground"
            >
              What we build
            </h2>
            <p className="what-we-build-subtitle what-we-build-reveal what-we-build-reveal--subtitle">
              Premium digital systems for businesses that need cleaner workflows, faster
              follow-ups and better visibility.
            </p>
            <p className="what-we-build-note what-we-build-reveal what-we-build-reveal--subtitle">
              Four core capabilities — a quick overview, not a catalogue of separate products.
              For examples, see{" "}
              <a href="#work" className="what-we-build-note__link">
                selected projects
              </a>
              ; for indicative costs, see{" "}
              <a href="/pricing" className="what-we-build-note__link">
                pricing
              </a>
              .
            </p>
          </header>

          <ol className="what-we-build-list" aria-label="Core capabilities">
            {WHAT_WE_BUILD_ITEMS.map((item, index) => (
              <li
                key={item.id}
                className="what-we-build-list__item what-we-build-reveal what-we-build-reveal--row"
                style={{ animationDelay: `${0.2 + index * 0.07}s` }}
              >
                <span className="what-we-build-list__index" aria-hidden>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="what-we-build-list__body">
                  <p className="what-we-build-list__label">{item.label}</p>
                  <h3 className="what-we-build-list__title">{item.title}</h3>
                  <p className="what-we-build-list__desc">{item.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

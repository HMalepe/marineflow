import { useEffect, useRef, useState } from "react";
import { useDeviceProfile } from "@/hooks/use-device-profile";

const AUDIENCE_CHIPS = [
  "Salons & barbers",
  "Clinics & pharmacies",
  "Restaurants & takeaways",
  "Service businesses",
  "Retail teams",
  "Small teams with too much admin",
  "Owners who want cleaner operations",
] as const;

export function WhoThisIsForSection() {
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
      id="audience"
      data-scroll-snap="audience"
      aria-labelledby="audience-heading"
      className={`who-for safe-area-x section-surface snap-section-panel relative isolate overflow-hidden px-4 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-24${sectionInView ? " who-for-in-view" : ""}`}
    >
      <div className="who-for-grid" aria-hidden />
      <div className="who-for-glow who-for-glow--center" aria-hidden />
      <div className="who-for-orbit" aria-hidden>
        <svg className="who-for-orbit__svg" viewBox="0 0 640 280" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="who-for-orbit-gradient" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="rgba(34, 230, 242, 0)" />
              <stop offset="28%" stopColor="rgba(34, 230, 242, 0.45)" />
              <stop offset="50%" stopColor="rgba(107, 53, 255, 0.35)" />
              <stop offset="72%" stopColor="rgba(255, 79, 216, 0.4)" />
              <stop offset="100%" stopColor="rgba(255, 79, 216, 0)" />
            </linearGradient>
          </defs>
          <ellipse
            className="who-for-orbit__ring"
            cx="320"
            cy="140"
            rx="280"
            ry="96"
            fill="none"
          />
        </svg>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <header className="who-for-header">
          <h2
            id="audience-heading"
            className="who-for-heading who-for-reveal who-for-reveal--heading font-display font-black uppercase tracking-tighter text-foreground"
          >
            Built for businesses where admin costs money
          </h2>
          <p className="who-for-body who-for-reveal who-for-reveal--body">
            Missed messages, slow follow-ups, manual bookings and messy spreadsheets quietly drain
            time. Solupair builds clean digital systems that help teams move faster.
          </p>
        </header>

        <ul className="who-for-chips" aria-label="Who Solupair is for">
          {AUDIENCE_CHIPS.map((label, index) => (
            <li
              key={label}
              className="who-for-chips__item who-for-reveal who-for-reveal--chip"
              style={{ animationDelay: `${0.26 + index * 0.06}s` }}
            >
              <span className="who-for-chip">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

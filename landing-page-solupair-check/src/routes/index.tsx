import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { ContactSection } from "@/components/contact-section";
import { HeroFaceBall } from "@/components/hero-face-ball";
import { FinalCtaSection } from "@/components/final-cta-section";
import { ProjectsSection } from "@/components/projects-section";
import { SiteHeader } from "@/components/site-header";
import { WhatWeBuildSection } from "@/components/what-we-build-section";
import { WhoThisIsForSection } from "@/components/who-this-is-for-section";

export const Route = createFileRoute("/")({
  component: NovaHome,
});

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

      <div className="hero-reveal hero-reveal--header relative z-20 shrink-0">
        <SiteHeader />
      </div>

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

function NovaHome() {
  return (
    <main className="scroll-snap-canvas min-h-[100dvh] bg-background font-sans text-foreground">
      <Hero />
      <WhatWeBuildSection />
      <WhoThisIsForSection />
      <ProjectsSection />
      <FinalCtaSection />
      <ContactSection />
    </main>
  );
}

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
import { useRef, useState } from "react";
import project1 from "@/assets/project1.jpg";
import project2 from "@/assets/project2.jpg";
import project3 from "@/assets/project3.jpg";
import project4 from "@/assets/project4.jpg";
import solupairLogo from "@/assets/solupair-logo.png";
import {
  DistortionProjectSlider,
  type DistortionSliderHandle,
} from "@/components/distortion-project-slider";

export const Route = createFileRoute("/")({
  component: NovaHome,
});

const projects = [
  { name: "Lumina", tag: "Interactive Dashboard", img: project1 },
  { name: "Chroma", tag: "3D Brand Identity", img: project2 },
  { name: "Forma", tag: "Product Showcase", img: project3 },
  { name: "Flux", tag: "Motion Platform", img: project4 },
];

function SolupairLogo() {
  return (
    <a href="https://solupair.co.za" className="inline-flex items-center">
      <img
        src={solupairLogo}
        alt="Solupair"
        className="h-10 w-10 object-contain sm:h-12 sm:w-12"
      />
    </a>
  );
}

function FaceBall() {
  const { scrollY } = useScroll();
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
      className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 sm:h-[360px] sm:w-[360px] lg:h-[440px] lg:w-[440px]"
    >
      <BouncingBall
        lidScale={lidScale}
        mouthRadius={mouthRadius}
        mouthHeight={mouthHeight}
        mouthWidth={mouthWidth}
        bounceAmp={bounceAmp}
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
};

function BouncingBall({ lidScale, mouthRadius, mouthHeight, mouthWidth, bounceAmp }: BallProps) {
  // Outer wrapper: scroll-driven amplitude as a CSS var.
  const ampPx = useTransform(bounceAmp, (v) => `${v}px`);
  return (
    <motion.div
      className="h-full w-full animate-[novaBounce_2.8s_ease-in-out_infinite]"
      style={{ ["--nova-amp" as string]: ampPx }}
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
  return (
    <section className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <header className="relative z-20 flex items-center justify-between px-6 py-6 sm:px-10 lg:px-14">
        <SolupairLogo />
        <nav className="flex items-center gap-2 sm:gap-3">
          <a
            href="#work"
            className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold tracking-wider text-foreground transition hover:border-primary hover:text-primary sm:px-5 sm:text-sm"
          >
            OUR WORK
          </a>
          <a
            href="#contact"
            className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold tracking-wider text-foreground transition hover:border-primary hover:text-primary sm:px-5 sm:text-sm"
          >
            GET IN TOUCH
          </a>
        </nav>
      </header>

      <div className="relative flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center px-2">
        <div className="relative z-0 mb-4 text-center text-xs font-medium tracking-[0.3em] text-primary sm:text-sm">
          WEB DESIGN AGENCY
        </div>

        <div className="relative w-full">
          <FaceBall />
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative z-0 w-full whitespace-nowrap text-center font-display font-black leading-[0.85] tracking-tighter text-foreground"
            style={{ fontSize: "clamp(4rem, 18vw, 18rem)" }}
          >
            WE DESIGN
          </motion.h1>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="relative z-0 w-full whitespace-nowrap text-center font-display font-black leading-[0.85] tracking-tighter text-primary"
            style={{ fontSize: "clamp(4rem, 18vw, 18rem)" }}
          >
            THE FUTURE
          </motion.h1>
        </div>

        <p className="mt-10 max-w-2xl text-center text-xs tracking-[0.2em] text-foreground/70 sm:text-sm">
          WEB APPLICATIONS, DASHBOARDS, WHATSAPP BOOKING AGENTS — AND PLENTY MORE BUSINESS SOLUTIONS
        </p>
      </div>
    </section>
  );
}

function Projects() {
  const sectionRef = useRef<HTMLElement>(null);
  const sliderRef = useRef<DistortionSliderHandle>(null);
  const scrollIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const targetIndex = Math.min(
      projects.length - 1,
      Math.max(0, Math.round(progress * (projects.length - 1))),
    );

    if (targetIndex === scrollIndexRef.current) return;
    scrollIndexRef.current = targetIndex;
    setActiveIndex(targetIndex);
    sliderRef.current?.transitionTo(targetIndex);
  });

  const project = projects[activeIndex];
  const imageSources = projects.map((item) => item.img);

  return (
    <section
      ref={sectionRef}
      id="work"
      className="relative"
      style={{ height: `${(projects.length - 1) * 55 + 100}vh` }}
    >
      <div
        className="sticky top-0 flex h-screen flex-col justify-center px-6 py-16 sm:px-10 lg:px-14"
        style={{ background: "var(--section-dark)" }}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <h2
              className="font-display font-black uppercase leading-[0.9] tracking-tighter text-foreground"
              style={{ fontSize: "clamp(3rem, 9vw, 9rem)" }}
            >
              Projects
            </h2>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.28em] text-foreground/45">
              Scroll to explore
            </p>
          </div>
          <p className="max-w-sm text-right text-xs tracking-[0.2em] text-foreground/70 sm:text-sm">
            WE CRAFT IMMERSIVE DIGITAL EXPERIENCES THAT PUSH THE BOUNDARIES OF WEB DESIGN &amp; MOTION.
          </p>
        </div>

        <div className="relative mx-auto mt-10 w-full max-w-7xl flex-1 sm:mt-12">
          <div className="relative h-full min-h-[320px] overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-[0_40px_120px_oklch(0_0_0_/_0.45)] sm:min-h-[420px] lg:min-h-[520px]">
            <DistortionProjectSlider
              ref={sliderRef}
              images={imageSources}
              className="absolute inset-0 overflow-hidden rounded-3xl"
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/35" />

            <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8 lg:p-10">
              <div className="flex items-start justify-between gap-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={`counter-${activeIndex}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                    className="font-mono text-xs tracking-[0.2em] text-white/70 sm:text-sm"
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
                    className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/90 backdrop-blur sm:text-xs"
                  >
                    {project.tag}
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="flex items-end justify-between gap-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.h3
                    key={`title-${activeIndex}`}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="font-display text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl"
                  >
                    {project.name}
                  </motion.h3>
                </AnimatePresence>

                <ArrowUpRight className="h-8 w-8 shrink-0 text-primary" />
              </div>
            </div>
          </div>

          <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 flex-col gap-4 lg:flex">
            {projects.map((item, index) => (
              <button
                key={item.name}
                type="button"
                aria-label={`View ${item.name}`}
                onClick={() => {
                  scrollIndexRef.current = index;
                  setActiveIndex(index);
                  sliderRef.current?.transitionTo(index);
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
      className="px-6 py-24 sm:px-10 lg:px-14 lg:py-32"
      style={{ background: "var(--section-dark)" }}
    >
      <div className="mx-auto max-w-7xl border-t border-white/10 pt-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div>
            <h2
              className="font-display font-black uppercase leading-[0.9] tracking-tighter text-foreground"
              style={{ fontSize: "clamp(2.5rem, 8vw, 7rem)" }}
            >
              Let's Talk
            </h2>
            <p className="mt-6 max-w-md text-xs uppercase tracking-[0.18em] text-foreground/70 sm:text-sm">
              Got a project in mind? We'd love to hear about it. Drop us a line and let's create something extraordinary.
            </p>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="mt-10 max-w-md space-y-6"
            >
              <input
                placeholder="YOUR NAME"
                className="w-full border-b border-white/20 bg-transparent py-3 text-sm tracking-wider text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none"
              />
              <input
                type="email"
                placeholder="YOUR EMAIL"
                className="w-full border-b border-white/20 bg-transparent py-3 text-sm tracking-wider text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none"
              />
              <textarea
                rows={3}
                placeholder="Tell us about your project"
                className="w-full resize-none border-b border-white/20 bg-transparent py-3 text-sm tracking-wider text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full border border-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-primary transition hover:bg-primary hover:text-primary-foreground"
              >
                Send Message <ArrowUpRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          <div className="lg:pl-12">
            <div className="space-y-6">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground/60">Email</div>
                <div className="mt-1 text-base text-foreground">hello@nova.studio</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground/60">Location</div>
                <div className="mt-1 text-base text-foreground">Paris, France</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-[11px] uppercase tracking-[0.2em] text-foreground/60">
          <div>© 2026 NØVA Studio. All rights reserved.</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary">Privacy</a>
            <a href="#" className="hover:text-primary">Terms</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function NovaHome() {
  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <Hero />
      <Projects />
      <Contact />
    </main>
  );
}
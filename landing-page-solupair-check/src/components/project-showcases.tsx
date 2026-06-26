import { type ReactNode, Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, Calendar, MessageCircle, TrendingUp, Zap } from "lucide-react";
import {
  DEMO_SALON_NAME,
  WHATSAPP_AGENT_NAME,
  demoBookingConfirmedBody,
  demoConfirmBookingBody,
  demoMainMenuBody,
  demoNewCustomerGreeting,
  demoPickServiceBody,
  demoPickSlotBody,
} from "@/lib/marineflow-bot-copy";

/** WhatsApp-style *bold* and _italic_ (subset of bot message formatting). */
function formatWaInline(line: string): ReactNode {
  const parts = line.split(/(\*[^*]+\*|_[^_]+_)/g);
  return parts.map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*")) {
      return <strong key={i}>{part.slice(1, -1)}</strong>;
    }
    if (part.startsWith("_") && part.endsWith("_")) {
      return <em key={i} className="text-white/75 not-italic">{part.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function formatWaText(text: string): ReactNode {
  return text.split("\n").map((line, i, lines) => (
    <Fragment key={i}>
      {formatWaInline(line)}
      {i < lines.length - 1 && <br />}
    </Fragment>
  ));
}

function BrowserChrome({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-2">
      <div className="flex gap-1.5">
        <span className="size-2 rounded-full bg-red-400/80" />
        <span className="size-2 rounded-full bg-amber-400/80" />
        <span className="size-2 rounded-full bg-emerald-400/80" />
      </div>
      <div className="mx-auto min-w-0 flex-1 truncate rounded-md bg-black/30 px-3 py-1 text-center text-[9px] text-white/50 sm:text-[10px]">
        {url}
      </div>
    </div>
  );
}

/** 01 — Animated marketing website in browser chrome */
export function AnimatedWebsitePreview() {
  const reduce = useReducedMotion();

  return (
    <div className="flex h-full w-full flex-col bg-[oklch(0.12_0.02_275)]">
      <BrowserChrome url="solupair.co.za/studio" />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
        <motion.div
          className="pointer-events-none absolute -left-8 top-8 h-32 w-32 rounded-full bg-primary/25 blur-3xl"
          animate={reduce ? undefined : { x: [0, 24, 0], y: [0, -16, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute -right-6 bottom-4 h-40 w-40 rounded-full bg-[oklch(0.55_0.22_300)]/30 blur-3xl"
          animate={reduce ? undefined : { x: [0, -20, 0], y: [0, 12, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative z-10 flex flex-1 flex-col justify-center gap-4">
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            className="text-[9px] font-semibold uppercase tracking-[0.35em] text-primary sm:text-[10px]"
          >
            Premium web experiences
          </motion.div>
          <motion.h4
            className="max-w-[14ch] font-display text-2xl font-black leading-[0.95] tracking-tight text-white sm:text-4xl"
            animate={reduce ? undefined : { opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            Motion that converts.
          </motion.h4>
          <motion.div
            className="h-1 w-16 rounded-full bg-primary"
            animate={reduce ? undefined : { width: ["4rem", "6rem", "4rem"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {["Scroll stories", "3D hero", "Micro-interactions"].map((label, i) => (
              <motion.span
                key={label}
                className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[8px] uppercase tracking-wider text-white/80 sm:text-[9px]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
              >
                {label}
              </motion.span>
            ))}
          </div>
        </div>

        <motion.div
          className="relative z-10 mt-auto grid grid-cols-3 gap-2"
          animate={reduce ? undefined : { y: [0, -4, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          {["98%", "2.4s", "4.9★"].map((stat, i) => (
            <div
              key={stat}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-center backdrop-blur-sm"
            >
              <div className="text-sm font-bold text-primary sm:text-base">{stat}</div>
              <div className="text-[7px] uppercase tracking-wider text-white/45 sm:text-[8px]">
                {["Lighthouse", "Load time", "Client rating"][i]}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta: string;
  icon: typeof TrendingUp;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5 sm:p-3">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[8px] uppercase tracking-wider text-white/45 sm:text-[9px]">{label}</span>
        <Icon className="size-3 text-primary/80" />
      </div>
      <div className="mt-1 text-lg font-bold text-white sm:text-xl">{value}</div>
      <div className="text-[9px] font-medium text-emerald-400">{delta}</div>
    </div>
  );
}

function LineChartMock({ reduce }: { reduce: boolean | null }) {
  const points = "8,42 28,34 48,38 68,22 88,26 108,14 128,18";
  return (
    <svg viewBox="0 0 136 48" className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.93 0.24 122)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="oklch(0.93 0.24 122)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.polyline
        fill="url(#lineFill)"
        stroke="none"
        points={`${points} 128,48 8,48`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.path
        fill="none"
        stroke="oklch(0.93 0.24 122)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={`M8,42 L28,34 L48,38 L68,22 L88,26 L108,14 L128,18`}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 1.2, ease: "easeOut" }}
      />
    </svg>
  );
}

/** 02 — Owner dashboard for the WhatsApp Agent (same name as chatbot slide). */
export function WhatsAppAgentDashboardPreview() {
  const reduce = useReducedMotion();

  return (
    <div className="flex h-full w-full flex-col bg-[oklch(0.11_0.015_270)] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-primary">
            {WHATSAPP_AGENT_NAME}
          </p>
          <h4 className="truncate font-display text-sm font-bold text-white sm:text-base">
            {DEMO_SALON_NAME}
          </h4>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-medium text-emerald-400">
          Bot live
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniKpi label="WA bookings" value="47" delta="+9 today" icon={MessageCircle} />
        <MiniKpi label="Confirmed" value="128" delta="Sam · Thu 10:30" icon={Calendar} />
        <MiniKpi label="Inbox" value="24" delta="6 handoff" icon={TrendingUp} />
      </div>

      <div className="mt-3 grid min-h-0 flex-1 grid-cols-5 gap-2">
        <div className="col-span-3 flex flex-col rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <p className="mb-1 text-[8px] uppercase tracking-wider text-white/45">
            Ladies Cut · WhatsApp funnel
          </p>
          <div className="min-h-[72px] flex-1 sm:min-h-[88px]">
            <LineChartMock reduce={reduce} />
          </div>
        </div>
        <div className="col-span-2 flex flex-col rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <p className="mb-1 text-[8px] uppercase tracking-wider text-white/45">Menu picks</p>
          <div className="flex min-h-[72px] flex-1 flex-col justify-center gap-1.5 sm:min-h-[88px]">
            {[
              { label: "Ladies Cut", pct: 72 },
              { label: "Full Colour", pct: 48 },
              { label: "Treatment", pct: 31 },
            ].map((row, i) => (
              <div key={row.label} className="flex items-center gap-1.5">
                <span className="w-14 shrink-0 truncate text-[7px] text-white/60 sm:text-[8px]">
                  {row.label}
                </span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${row.pct}%` }}
                    transition={{ delay: reduce ? 0 : i * 0.1, duration: 0.45 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AreaChartMock({ reduce, color }: { reduce: boolean | null; color: string }) {
  return (
    <svg viewBox="0 0 120 40" className="h-full w-full" preserveAspectRatio="none">
      <motion.path
        fill={color}
        fillOpacity="0.25"
        d="M0,38 L20,28 L40,32 L60,18 L80,24 L100,12 L120,16 L120,40 L0,40 Z"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0 : 0.8 }}
      />
      <motion.path
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        d="M0,38 L20,28 L40,32 L60,18 L80,24 L100,12 L120,16"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 1 }}
      />
    </svg>
  );
}

function PieChartMock({ reduce }: { reduce: boolean | null }) {
  const slices = [
    { color: "oklch(0.93 0.24 122)", dash: "70 100" },
    { color: "oklch(0.55 0.22 300)", dash: "45 100", offset: -70 },
    { color: "oklch(0.72 0.18 200)", dash: "35 100", offset: -115 },
  ];
  return (
    <svg viewBox="0 0 64 64" className="mx-auto h-16 w-16 sm:h-20 sm:w-20">
      <circle cx="32" cy="32" r="22" fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="12" />
      {slices.map((s, i) => (
        <motion.circle
          key={i}
          cx="32"
          cy="32"
          r="22"
          fill="none"
          stroke={s.color}
          strokeWidth="12"
          strokeLinecap="butt"
          strokeDasharray={s.dash}
          strokeDashoffset={s.offset ?? 0}
          transform="rotate(-90 32 32)"
          initial={{ strokeDasharray: "0 100" }}
          animate={{ strokeDasharray: s.dash }}
          transition={{ duration: reduce ? 0 : 0.7, delay: i * 0.12 }}
        />
      ))}
    </svg>
  );
}

function ScatterBarsMock({ reduce }: { reduce: boolean | null }) {
  const bars = [35, 58, 42, 71, 49, 63, 38, 55];
  const colors = [
    "bg-primary",
    "bg-[oklch(0.55_0.22_300)]",
    "bg-primary/70",
    "bg-[oklch(0.72_0.18_200)]",
  ];
  return (
    <div className="flex h-full items-end justify-between gap-0.5">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className={`w-full rounded-t-sm ${colors[i % colors.length]}`}
          initial={{ height: 0 }}
          animate={{ height: `${h}%` }}
          transition={{ delay: reduce ? 0 : i * 0.05, duration: 0.4 }}
        />
      ))}
    </div>
  );
}

/** 04 — Generic analytics with varied chart types (not tied to the bot). */
export function RandomChartsDashboardPreview() {
  const reduce = useReducedMotion();

  return (
    <div className="flex h-full w-full flex-col bg-[oklch(0.09_0.01_260)] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[oklch(0.72_0.22_300)]">
            Custom analytics
          </p>
          <h4 className="font-display text-sm font-bold text-white sm:text-base">Charts &amp; graphs</h4>
        </div>
        <BarChart3 className="size-4 text-white/40" aria-hidden />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-6 grid-rows-2 gap-2">
        <div className="col-span-3 row-span-1 flex flex-col rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <p className="mb-1 text-[8px] uppercase tracking-wider text-white/45">Velocity index</p>
          <div className="min-h-[48px] flex-1">
            <AreaChartMock reduce={reduce} color="oklch(0.55 0.22 300)" />
          </div>
        </div>

        <div className="col-span-3 row-span-1 flex flex-col rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <p className="mb-1 text-[8px] uppercase tracking-wider text-white/45">Channel mix</p>
          <div className="flex flex-1 items-center justify-center">
            <PieChartMock reduce={reduce} />
          </div>
        </div>

        <div className="col-span-4 row-span-1 flex flex-col rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <p className="mb-1 text-[8px] uppercase tracking-wider text-white/45">Weekly signal</p>
          <div className="min-h-[44px] flex-1">
            <ScatterBarsMock reduce={reduce} />
          </div>
        </div>

        <div className="col-span-2 row-span-1 flex flex-col justify-between rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <p className="text-[8px] uppercase tracking-wider text-white/45">KPI delta</p>
          <div className="space-y-1.5">
            {[
              { label: "Conv.", val: "+12%" },
              { label: "CAC", val: "-8%" },
              { label: "LTV", val: "+24%" },
            ].map((k) => (
              <div key={k.label} className="flex justify-between text-[8px] sm:text-[9px]">
                <span className="text-white/50">{k.label}</span>
                <span className="font-semibold text-primary">{k.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  from,
  text,
  delay = 0,
  compact,
}: {
  from: "bot" | "user";
  text: string;
  delay?: number;
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const isBot = from === "bot";

  return (
    <motion.div
      className={`flex shrink-0 ${isBot ? "justify-start" : "justify-end"}`}
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: reduce ? 0 : delay, duration: 0.35 }}
    >
      <div
        className={`max-w-[92%] rounded-2xl px-2.5 py-1.5 leading-snug ${
          compact ? "text-[7.5px] sm:text-[8px]" : "text-[8px] sm:text-[9px]"
        } ${
          isBot
            ? "rounded-tl-sm bg-[#202c33] text-white/90"
            : "rounded-tr-sm bg-[#005c4b] text-white"
        }`}
      >
        {from === "bot" ? formatWaText(text) : text}
      </div>
    </motion.div>
  );
}

/** 03 — MarineFlow WhatsApp booking agent (production bot copy) */
export function WhatsAppChatbotPreview() {
  const reduce = useReducedMotion();

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0b141a] via-[#111b21] to-[#0b141a] p-3 sm:p-5">
      <div className="flex h-full max-h-[100%] w-full max-w-[240px] flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0b141a] shadow-[0_20px_60px_oklch(0_0_0_/_0.5)] sm:max-w-[280px]">
        <div className="flex items-center justify-between px-4 pt-2 text-[8px] text-white/50">
          <span>9:41</span>
          <div className="mx-auto h-4 w-16 rounded-full bg-black/80" />
          <span>5G</span>
        </div>

        <div className="flex items-center gap-2 border-b border-white/5 bg-[#1f2c34] px-3 py-2.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
            {DEMO_SALON_NAME.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold text-white">{DEMO_SALON_NAME}</p>
            <p className="text-[8px] text-emerald-400">online</p>
          </div>
          <Zap className="size-3.5 text-primary" aria-hidden />
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain p-2.5 sm:gap-2"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, oklch(0.93 0.24 122 / 0.04) 0%, transparent 50%)",
          }}
        >
          <ChatBubble from="bot" delay={0} text={demoNewCustomerGreeting} />
          <ChatBubble from="bot" delay={0.08} text={demoMainMenuBody()} compact />
          <ChatBubble from="user" delay={0.18} text="1" />
          <ChatBubble from="bot" delay={0.28} text={demoPickServiceBody} />
          <ChatBubble from="user" delay={0.38} text="1" />
          <ChatBubble from="bot" delay={0.48} text={demoPickSlotBody} compact />
          <ChatBubble from="user" delay={0.58} text="1" />
          <ChatBubble from="bot" delay={0.68} text={demoConfirmBookingBody} compact />
          <ChatBubble from="user" delay={0.78} text="Yes, confirm" />
          <ChatBubble from="bot" delay={0.88} text={demoBookingConfirmedBody} compact />

          {!reduce && (
            <motion.div
              className="flex shrink-0 justify-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.35, 0.9, 0.35] }}
              transition={{ delay: 1.1, duration: 1.6, repeat: Infinity }}
            >
              <div className="flex gap-1 rounded-2xl rounded-tl-sm bg-[#202c33] px-3 py-2">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="size-1 rounded-full bg-white/40"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ delay: i * 0.2, duration: 0.8, repeat: Infinity }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-white/5 bg-[#1f2c34] px-2 py-2">
          <div className="h-7 flex-1 rounded-full bg-[#2a3942] px-3 text-[9px] leading-7 text-white/35">
            Type a message
          </div>
          <div className="flex size-7 items-center justify-center rounded-full bg-primary text-[#0b141a]">
            <MessageCircle className="size-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}

export const PROJECT_SHOWCASES = [
  {
    id: "websites",
    name: "Motion Websites",
    tag: "Animated Web Experiences",
    Preview: AnimatedWebsitePreview,
  },
  {
    id: "whatsapp-dashboard",
    name: WHATSAPP_AGENT_NAME,
    tag: `${DEMO_SALON_NAME} · owner dashboard`,
    Preview: WhatsAppAgentDashboardPreview,
  },
  {
    id: "whatsapp",
    name: WHATSAPP_AGENT_NAME,
    tag: "MarineFlow booking bot",
    Preview: WhatsAppChatbotPreview,
  },
  {
    id: "analytics",
    name: "Custom Analytics",
    tag: "Charts & graphs",
    Preview: RandomChartsDashboardPreview,
  },
] as const;

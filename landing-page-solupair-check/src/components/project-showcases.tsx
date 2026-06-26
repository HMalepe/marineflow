import { type ReactNode, Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, Calendar, MessageCircle, TrendingUp, Users, Zap } from "lucide-react";
import {
  DEMO_SALON_NAME,
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

function BarChartMock({ reduce }: { reduce: boolean | null }) {
  const bars = [62, 44, 78, 52, 88, 36];
  return (
    <div className="flex h-full items-end justify-between gap-1 px-1">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-t-sm bg-gradient-to-t from-primary/30 to-primary"
          initial={{ height: 0 }}
          animate={{ height: `${h}%` }}
          transition={{ delay: reduce ? 0 : i * 0.08, duration: 0.5, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/** 02 — Live operations dashboard: bookings & revenue */
export function OperationsDashboardPreview() {
  const reduce = useReducedMotion();

  return (
    <div className="flex h-full w-full flex-col bg-[oklch(0.11_0.015_270)] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-primary">Live Pulse</p>
          <h4 className="font-display text-sm font-bold text-white sm:text-base">Operations dashboard</h4>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-medium text-emerald-400">
          Live
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniKpi label="Bookings" value="128" delta="+18% wk" icon={Calendar} />
        <MiniKpi label="Revenue" value="R84k" delta="+12% wk" icon={TrendingUp} />
        <MiniKpi label="Inbox" value="24" delta="6 handoff" icon={MessageCircle} />
      </div>

      <div className="mt-3 grid min-h-0 flex-1 grid-cols-5 gap-2">
        <div className="col-span-3 flex flex-col rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <p className="mb-1 text-[8px] uppercase tracking-wider text-white/45">Bookings · 7 days</p>
          <div className="min-h-[72px] flex-1 sm:min-h-[88px]">
            <LineChartMock reduce={reduce} />
          </div>
        </div>
        <div className="col-span-2 flex flex-col rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <p className="mb-1 text-[8px] uppercase tracking-wider text-white/45">Top services</p>
          <div className="min-h-[72px] flex-1 sm:min-h-[88px]">
            <BarChartMock reduce={reduce} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DonutMock({ reduce }: { reduce: boolean | null }) {
  return (
    <svg viewBox="0 0 80 80" className="mx-auto h-20 w-20 sm:h-24 sm:w-24">
      <circle cx="40" cy="40" r="28" fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="10" />
      <motion.circle
        cx="40"
        cy="40"
        r="28"
        fill="none"
        stroke="oklch(0.93 0.24 122)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray="120 176"
        transform="rotate(-90 40 40)"
        initial={{ strokeDasharray: "0 176" }}
        animate={{ strokeDasharray: "120 176" }}
        transition={{ duration: reduce ? 0 : 1, ease: "easeOut" }}
      />
      <motion.circle
        cx="40"
        cy="40"
        r="28"
        fill="none"
        stroke="oklch(0.55 0.22 300)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray="56 176"
        strokeDashoffset="-120"
        transform="rotate(-90 40 40)"
        initial={{ strokeDasharray: "0 176" }}
        animate={{ strokeDasharray: "56 176" }}
        transition={{ duration: reduce ? 0 : 1, delay: 0.2, ease: "easeOut" }}
      />
      <text x="40" y="42" textAnchor="middle" className="fill-white text-[11px] font-bold">
        68%
      </text>
    </svg>
  );
}

/** 03 — Insights dashboard: retention, growth, team */
export function AnalyticsDashboardPreview() {
  const reduce = useReducedMotion();
  const rows = [
    { name: "Thandi", pct: 92 },
    { name: "Lerato", pct: 78 },
    { name: "James", pct: 65 },
  ];

  return (
    <div className="flex h-full w-full flex-col bg-[oklch(0.1_0.012_265)] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[oklch(0.72_0.22_300)]">
            Insights
          </p>
          <h4 className="font-display text-sm font-bold text-white sm:text-base">Analytics &amp; performance</h4>
        </div>
        <BarChart3 className="size-4 text-white/40" />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
        <div className="flex flex-col rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <p className="text-[8px] uppercase tracking-wider text-white/45">Customer retention</p>
          <DonutMock reduce={reduce} />
          <p className="mt-auto text-center text-[8px] text-white/50">Returning vs new</p>
        </div>

        <div className="flex flex-col rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <p className="mb-2 text-[8px] uppercase tracking-wider text-white/45">Growth trend</p>
          <div className="flex flex-1 flex-col justify-end gap-1">
            {[40, 55, 48, 72, 68, 90].map((w, i) => (
              <motion.div
                key={i}
                className="h-1.5 rounded-full bg-gradient-to-r from-[oklch(0.55_0.22_300)] to-primary"
                initial={{ width: 0 }}
                animate={{ width: `${w}%` }}
                transition={{ delay: reduce ? 0 : i * 0.06, duration: 0.4 }}
              />
            ))}
          </div>
          <p className="mt-2 text-[9px] text-emerald-400">+34% quarter</p>
        </div>

        <div className="col-span-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
          <div className="mb-2 flex items-center gap-1.5">
            <Users className="size-3 text-primary" />
            <p className="text-[8px] uppercase tracking-wider text-white/45">Team performance</p>
          </div>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={row.name} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[9px] text-white/70">{row.name}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${row.pct}%` }}
                    transition={{ delay: reduce ? 0 : 0.3 + i * 0.1, duration: 0.5 }}
                  />
                </div>
                <span className="w-8 text-right text-[9px] font-medium text-white/80">{row.pct}%</span>
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

/** 04 — MarineFlow WhatsApp booking agent (production bot copy) */
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
    id: "operations",
    name: "Live Pulse",
    tag: "Operations Dashboard",
    Preview: OperationsDashboardPreview,
  },
  {
    id: "analytics",
    name: "Insights",
    tag: "Analytics Dashboard",
    Preview: AnalyticsDashboardPreview,
  },
  {
    id: "whatsapp",
    name: "WhatsApp Agent",
    tag: "MarineFlow booking bot",
    Preview: WhatsAppChatbotPreview,
  },
] as const;

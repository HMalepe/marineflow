import { type ReactNode, Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  MessageCircle,
  Radio,
  Search,
  User,
  Zap,
} from "lucide-react";
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

function formatWaInline(line: string): ReactNode {
  const parts = line.split(/(\*[^*]+\*|_[^_]+_)/g);
  return parts.map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*")) {
      return <strong key={i}>{part.slice(1, -1)}</strong>;
    }
    if (part.startsWith("_") && part.endsWith("_")) {
      return (
        <em key={i} className="text-white/75 not-italic">
          {part.slice(1, -1)}
        </em>
      );
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

function ShowcaseFrame({
  children,
  surface = "dark",
}: {
  children: ReactNode;
  surface?: "dark" | "light";
}) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[oklch(0.06_0.01_260)] via-[oklch(0.09_0.015_270)] to-[oklch(0.07_0.02_275)] p-2 sm:p-4">
      <div
        className={`flex h-full w-full max-h-full min-h-0 flex-col overflow-hidden rounded-xl border shadow-[0_28px_90px_oklch(0_0_0_/_0.55)] ${
          surface === "light"
            ? "border-white/20 bg-[oklch(0.98_0.005_270)]"
            : "border-white/10 bg-[oklch(0.11_0.015_270)]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function WindowDots() {
  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-black/[0.06] bg-white/80 px-3 py-2">
      <span className="size-2 rounded-full bg-[#ff5f57]" />
      <span className="size-2 rounded-full bg-[#febc2e]" />
      <span className="size-2 rounded-full bg-[#28c840]" />
      <div className="mx-auto min-w-0 flex-1 truncate px-2 text-center text-[8px] font-medium text-black/35 sm:text-[9px]">
        Premium dashboard preview
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

/** ExpiryDesk PRO — pharmacy inventory mock (light, premium). */
export function ExpiryDeskDashboardPreview() {
  const reduce = useReducedMotion();

  return (
    <ShowcaseFrame surface="light">
      <WindowDots />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,oklch(0.99_0.008_275)_0%,oklch(0.96_0.012_280)_100%)] p-2.5 sm:p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="font-display text-[11px] font-bold tracking-tight text-[oklch(0.42_0.22_275)] sm:text-xs">
              ExpiryDesk <span className="font-black">PRO</span>
            </p>
            <p className="text-[7px] font-medium uppercase tracking-[0.18em] text-black/40 sm:text-[8px]">
              Inventory · expiry intelligence
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-[oklch(0.94_0.04_275)] px-2 py-0.5 text-[7px] font-semibold text-[oklch(0.42_0.22_275)]">
              Rands
            </span>
            <div className="relative size-9 sm:size-10">
              <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="oklch(0.92 0.02 275)" strokeWidth="4" />
                <motion.circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="oklch(0.55 0.22 275)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="78 100"
                  initial={{ strokeDasharray: "0 100" }}
                  animate={{ strokeDasharray: "78 100" }}
                  transition={{ duration: reduce ? 0 : 0.9 }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-[oklch(0.42_0.22_275)]">
                78%
              </span>
            </div>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-3 gap-1.5 sm:gap-2">
          {[
            { label: "Write-offs", value: "R 0", sub: "2 items", tone: "border-[oklch(0.82_0.12_350)] bg-[oklch(0.97_0.03_350)] text-[oklch(0.55_0.18_350)]" },
            { label: "At risk", value: "R 0", sub: "1 item ≤ 120d", tone: "border-[oklch(0.85_0.14_65)] bg-[oklch(0.98_0.04_65)] text-[oklch(0.58_0.16_55)]" },
            { label: "Recovered", value: "R 0", sub: "4 items", tone: "border-[oklch(0.85_0.12_145)] bg-[oklch(0.97_0.04_145)] text-[oklch(0.48_0.14_145)]" },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              className={`rounded-lg border px-2 py-1.5 ${card.tone}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : i * 0.06 }}
            >
              <p className="text-[6px] font-bold uppercase tracking-wider opacity-80 sm:text-[7px]">{card.label}</p>
              <p className="text-[10px] font-black sm:text-[11px]">{card.value}</p>
              <p className="text-[6px] font-medium opacity-70 sm:text-[7px]">{card.sub}</p>
            </motion.div>
          ))}
        </div>

        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[8px] font-bold text-black/70 sm:text-[9px]">Inventory lines</p>
          <div className="flex gap-1">
            {["Critical 1", "At risk 0", "Safe 2"].map((pill) => (
              <span
                key={pill}
                className="rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[6px] font-semibold text-black/45 sm:text-[7px]"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-black/[0.06] bg-white px-2 py-1">
          <Search className="size-3 shrink-0 text-black/30" />
          <span className="text-[7px] text-black/35 sm:text-[8px]">Search name or dose…</span>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-3 gap-1.5 sm:gap-2">
          {[
            { name: "POLYGYNAX", badge: "CRITICAL", badgeTone: "bg-[oklch(0.58_0.20_350)]", days: "1d to sell-by" },
            { name: "LOCOID CRELO", badge: "SAFE", badgeTone: "bg-[oklch(0.52_0.14_145)]", days: "Nov 2027" },
            { name: "SIMBRINZA", badge: "SAFE", badgeTone: "bg-[oklch(0.52_0.14_145)]", days: "Nov 2027" },
          ].map((item, i) => (
            <motion.div
              key={item.name}
              className="flex min-h-0 flex-col rounded-lg border border-black/[0.07] bg-white p-1.5 shadow-[0_8px_24px_oklch(0_0_0_/_0.06)]"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: reduce ? 0 : 0.15 + i * 0.08 }}
            >
              <div className="mb-1 flex items-start justify-between gap-1">
                <span className={`rounded px-1 py-0.5 text-[5px] font-bold text-white sm:text-[6px] ${item.badgeTone}`}>
                  {item.badge}
                </span>
                <AlertTriangle className="size-2.5 text-[oklch(0.58_0.18_55)]" />
              </div>
              <p className="line-clamp-2 text-[6px] font-bold leading-tight text-black/75 sm:text-[7px]">{item.name}</p>
              <p className="mt-auto pt-1 text-[6px] font-medium text-[oklch(0.58_0.18_55)] sm:text-[7px]">{item.days}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </ShowcaseFrame>
  );
}

/** Solupair Live Pulse — owner dashboard mock (light, premium). */
export function LivePulseDashboardPreview() {
  const reduce = useReducedMotion();

  return (
    <ShowcaseFrame surface="light">
      <WindowDots />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-[22%] shrink-0 flex-col border-r border-black/[0.06] bg-[oklch(0.985_0.008_285)] p-2 sm:flex">
          <div className="mb-2 flex items-center gap-1.5">
            <div className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-[oklch(0.55_0.22_275)] to-[oklch(0.62_0.20_330)] text-[7px] font-black text-white">
              SP
            </div>
            <div className="min-w-0">
              <p className="truncate text-[6px] font-bold text-black/70">Bontle-Entle</p>
              <p className="truncate text-[5px] text-black/40">Mmaki Malepe</p>
            </div>
          </div>
          <div className="mb-2 rounded-md border border-black/[0.05] bg-white px-1.5 py-1 text-[5px] text-black/35">
            Search pages…
          </div>
          {["Today at a glance", "Bookings", "Live Pulse", "Inbox", "Clients"].map((item, i) => (
            <div
              key={item}
              className={`mb-0.5 rounded-md px-1.5 py-1 text-[6px] font-medium ${
                i === 2
                  ? "bg-[oklch(0.94_0.04_285)] font-semibold text-[oklch(0.42_0.22_275)]"
                  : "text-black/45"
              }`}
            >
              {item}
              {item === "Inbox" && (
                <span className="ml-1 inline-block size-1 rounded-full bg-red-500 align-middle" />
              )}
            </div>
          ))}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[oklch(0.985_0.006_270)] p-2 sm:p-2.5">
          <p className="mb-1.5 font-display text-[10px] font-bold text-black/80 sm:text-[11px]">Live Pulse</p>

          <motion.div
            className="mb-2 rounded-xl border border-[oklch(0.88_0.06_200)] bg-gradient-to-r from-[oklch(0.97_0.03_200)] to-white p-2 shadow-[0_10px_30px_oklch(0.55_0.12_200_/_0.12)]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.5 }}
          >
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-[oklch(0.72_0.14_200)] text-white">
                <Radio className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[9px] font-bold text-black/80 sm:text-[10px]">Live Pulse</p>
                <p className="line-clamp-2 text-[6px] leading-snug text-black/45 sm:text-[7px]">
                  Air-traffic control for your floor — chairs, arrivals, payments, and bot conversations right now.
                </p>
              </div>
              <span className="hidden rounded-full border border-[oklch(0.78_0.08_200)] bg-white px-1.5 py-0.5 text-[6px] font-semibold text-[oklch(0.48_0.12_200)] sm:inline">
                Polling
              </span>
            </div>
          </motion.div>

          <p className="mb-1 text-[7px] font-bold uppercase tracking-wider text-black/50 sm:text-[8px]">Live summary</p>
          <div className="mb-2 grid grid-cols-5 gap-1">
            {[
              { label: "In chair", value: "0", color: "text-[oklch(0.48_0.14_145)]" },
              { label: "Idle", value: "9", color: "text-black/70" },
              { label: "Arriving", value: "0", color: "text-[oklch(0.48_0.14_240)]" },
              { label: "Pay hold", value: "0", color: "text-[oklch(0.58_0.16_55)]" },
              { label: "Chats", value: "0", color: "text-[oklch(0.48_0.18_285)]" },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                className="rounded-lg border border-black/[0.06] bg-white px-1 py-1 text-center"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduce ? 0 : i * 0.05 }}
              >
                <p className={`text-[10px] font-black tabular-nums sm:text-[11px] ${m.color}`}>{m.value}</p>
                <p className="text-[5px] font-semibold uppercase tracking-wide text-black/35 sm:text-[6px]">{m.label}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5 sm:gap-2">
            <div className="flex min-h-0 flex-col rounded-lg border border-black/[0.06] bg-white p-1.5">
              <p className="mb-1 text-[7px] font-bold text-black/60 sm:text-[8px]">Stations</p>
              <div className="grid flex-1 grid-cols-3 gap-1">
                {["Alice", "Bob", "Peter"].map((name) => (
                  <div key={name} className="rounded-md border border-black/[0.05] bg-[oklch(0.98_0.004_270)] p-1">
                    <div className="mb-0.5 flex items-center gap-0.5">
                      <User className="size-2 text-black/30" />
                      <span className="truncate text-[6px] font-semibold text-black/65">{name}</span>
                    </div>
                    <span className="text-[5px] font-medium text-black/40">Idle · open</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex min-h-0 flex-col rounded-lg border border-black/[0.06] bg-white p-1.5">
              <p className="mb-1 text-[7px] font-bold text-black/60 sm:text-[8px]">Bot conversations</p>
              <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-black/[0.08] bg-[oklch(0.99_0.004_285)] px-2 text-center">
                <MessageCircle className="mb-1 size-3.5 text-[oklch(0.48_0.18_285)]/50" />
                <p className="text-[6px] font-medium text-black/40 sm:text-[7px]">No active WhatsApp flows</p>
                <p className="mt-0.5 text-[6px] font-semibold text-[oklch(0.48_0.18_285)]">Open inbox →</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ShowcaseFrame>
  );
}

/** MarineFlow WhatsApp booking agent — phone mock. */
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
    id: "expiry-desk",
    name: "ExpiryDesk Dashboard",
    tag: "Pharmacy inventory · expiry tracking",
    Preview: ExpiryDeskDashboardPreview,
  },
  {
    id: "live-pulse",
    name: "Live Pulse",
    tag: "Solupair · WhatsApp booking engine",
    Preview: LivePulseDashboardPreview,
  },
  {
    id: "whatsapp-agent",
    name: WHATSAPP_AGENT_NAME,
    tag: "MarineFlow booking bot",
    Preview: WhatsAppChatbotPreview,
  },
] as const;

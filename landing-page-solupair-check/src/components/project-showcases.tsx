import { type ReactNode, Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Clock,
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
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-bg-deep via-bg-main to-bg-deep p-2 sm:p-3">
      <div
        className={`flex h-full w-full max-h-full min-h-0 flex-col overflow-hidden rounded-xl border border-subtle shadow-[0_28px_90px_color-mix(in_srgb,var(--bg-deep)_55%,transparent)] ${
          surface === "light"
            ? "border-glass bg-[oklch(0.98_0.005_270)]"
            : "border-glass bg-[color-mix(in_srgb,var(--bg-deep)_88%,var(--bg-main))]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function WindowDots({ title }: { title: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-black/[0.06] bg-[oklch(0.97_0.006_270)] px-3 py-2">
      <span className="size-2.5 rounded-full bg-[#ff5f57]" />
      <span className="size-2.5 rounded-full bg-[#febc2e]" />
      <span className="size-2.5 rounded-full bg-[#28c840]" />
      <div className="mx-auto min-w-0 flex-1 truncate px-3 text-center text-[9px] font-medium text-black/40 sm:text-[10px]">
        {title}
      </div>
    </div>
  );
}

function ChatBubble({
  from,
  text,
  time,
  delay = 0,
}: {
  from: "bot" | "user";
  text: string;
  time?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const isBot = from === "bot";

  return (
    <motion.div
      className={`flex shrink-0 flex-col ${isBot ? "items-start" : "items-end"}`}
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: reduce ? 0 : delay, duration: 0.35 }}
    >
      <div
        className={`max-w-[94%] rounded-2xl px-3 py-2 text-[9px] leading-relaxed sm:text-[10px] ${
          isBot
            ? "rounded-tl-md bg-[#202c33] text-white/92"
            : "rounded-tr-md bg-[#005c4b] text-white"
        }`}
      >
        {from === "bot" ? formatWaText(text) : text}
      </div>
      {time && (
        <span className="mt-0.5 px-1 text-[7px] text-white/35 sm:text-[8px]">{time}</span>
      )}
    </motion.div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  trend,
  tone,
  delay = 0,
}: {
  label: string;
  value: string;
  sub: string;
  trend?: "up" | "down";
  tone: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`rounded-xl border px-2.5 py-2 sm:px-3 sm:py-2.5 ${tone}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : delay }}
    >
      <p className="text-[8px] font-bold uppercase tracking-wider opacity-75 sm:text-[9px]">{label}</p>
      <div className="mt-0.5 flex items-end justify-between gap-1">
        <p className="text-sm font-black tabular-nums sm:text-base">{value}</p>
        {trend && (
          <span className={`flex items-center text-[8px] font-bold sm:text-[9px] ${trend === "up" ? "text-emerald-600" : "text-rose-600"}`}>
            {trend === "up" ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[8px] font-medium opacity-70 sm:text-[9px]">{sub}</p>
    </motion.div>
  );
}

/** ExpiryDesk PRO — pharmacy inventory mock. */
export function ExpiryDeskDashboardPreview() {
  const reduce = useReducedMotion();

  const rows = [
    { name: "POLYGYNAX VAG CAPS", dose: "6 caps", qty: 14, value: "R 4,872", expires: "12 Jun 2026", status: "CRITICAL", days: "1d left", tone: "bg-rose-500" },
    { name: "PANADO 500MG", dose: "Tablets", qty: 48, value: "R 892", expires: "18 Aug 2026", status: "AT RISK", days: "68d", tone: "bg-amber-500" },
    { name: "LOCOID CRELO 0.1%", dose: "30g", qty: 6, value: "R 1,240", expires: "Nov 2027", status: "SAFE", days: "517d", tone: "bg-emerald-500" },
    { name: "SIMBRINZA EYE DROP", dose: "5ml", qty: 3, value: "R 2,180", expires: "Mar 2028", status: "SAFE", days: "642d", tone: "bg-emerald-500" },
    { name: "ACC 200 EFF", dose: "25s", qty: 22, value: "R 1,540", expires: "Sep 2026", status: "AT RISK", days: "94d", tone: "bg-amber-500" },
  ];

  return (
    <ShowcaseFrame surface="light">
      <WindowDots title="app.expirydesk.co.za — Riverside Pharmacy" />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,oklch(0.995_0.006_275)_0%,oklch(0.96_0.012_280)_100%)] p-3 sm:p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-sm font-bold tracking-tight text-[oklch(0.38_0.24_275)] sm:text-base">
              ExpiryDesk <span className="font-black">PRO</span>
            </p>
            <p className="text-[9px] font-medium text-black/45 sm:text-[10px]">
              Riverside Pharmacy · 247 SKUs tracked
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[oklch(0.94_0.04_275)] px-2.5 py-1 text-[9px] font-semibold text-[oklch(0.42_0.22_275)] sm:text-[10px]">
              ZAR
            </span>
            <div className="relative size-11 sm:size-12">
              <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="oklch(0.92 0.02 275)" strokeWidth="3.5" />
                <motion.circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="oklch(0.52 0.24 275)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray="78 100"
                  initial={{ strokeDasharray: "0 100" }}
                  animate={{ strokeDasharray: "78 100" }}
                  transition={{ duration: reduce ? 0 : 0.9 }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-[oklch(0.38_0.24_275)]">
                78
              </span>
            </div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2 sm:gap-2.5">
          <KpiCard
            label="Write-offs"
            value="R 2,840"
            sub="3 lines this month"
            trend="down"
            tone="border-rose-200/80 bg-rose-50 text-rose-800"
            delay={0}
          />
          <KpiCard
            label="At risk"
            value="R 14,920"
            sub="8 lines ≤ 120 days"
            tone="border-amber-200/80 bg-amber-50 text-amber-900"
            delay={0.06}
          />
          <KpiCard
            label="Recovered"
            value="R 51,6k"
            sub="12 lines saved"
            trend="up"
            tone="border-emerald-200/80 bg-emerald-50 text-emerald-900"
            delay={0.12}
          />
        </div>

        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold text-black/70 sm:text-[11px]">Inventory lines</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "Critical 1", cls: "bg-rose-100 text-rose-700" },
              { label: "At risk 8", cls: "bg-amber-100 text-amber-800" },
              { label: "Safe 238", cls: "bg-emerald-100 text-emerald-800" },
            ].map((pill) => (
              <span
                key={pill.label}
                className={`rounded-full px-2 py-0.5 text-[8px] font-bold sm:text-[9px] ${pill.cls}`}
              >
                {pill.label}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-2 flex items-center gap-2 rounded-lg border border-black/[0.07] bg-white px-3 py-2 shadow-sm">
          <Search className="size-3.5 shrink-0 text-black/30" />
          <span className="text-[9px] text-black/40 sm:text-[10px]">Search product, dose or batch…</span>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-sm">
          <div className="grid grid-cols-[1.4fr_0.7fr_0.5fr_0.7fr_0.6fr] gap-1 border-b border-black/[0.06] bg-[oklch(0.98_0.004_270)] px-2.5 py-2 text-[7px] font-bold uppercase tracking-wider text-black/40 sm:grid-cols-[1.5fr_0.8fr_0.55fr_0.75fr_0.65fr] sm:px-3 sm:text-[8px]">
            <span>Product</span>
            <span>Qty</span>
            <span>Value</span>
            <span>Expires</span>
            <span className="text-right">Status</span>
          </div>
          <div className="divide-y divide-black/[0.05] overflow-y-auto">
            {rows.map((row, i) => (
              <motion.div
                key={row.name}
                className="grid grid-cols-[1.4fr_0.7fr_0.5fr_0.7fr_0.6fr] items-center gap-1 px-2.5 py-2 sm:grid-cols-[1.5fr_0.8fr_0.55fr_0.75fr_0.65fr] sm:px-3 sm:py-2.5"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduce ? 0 : 0.1 + i * 0.05 }}
              >
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-bold text-black/80 sm:text-[10px]">{row.name}</p>
                  <p className="text-[8px] text-black/40 sm:text-[9px]">{row.dose}</p>
                </div>
                <p className="text-[9px] font-semibold tabular-nums text-black/70 sm:text-[10px]">{row.qty}</p>
                <p className="text-[9px] font-bold tabular-nums text-black/75 sm:text-[10px]">{row.value}</p>
                <p className="text-[8px] font-medium text-black/55 sm:text-[9px]">{row.expires}</p>
                <div className="flex justify-end">
                  <span className={`rounded-md px-1.5 py-0.5 text-[7px] font-bold text-white sm:text-[8px] ${row.tone}`}>
                    {row.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </ShowcaseFrame>
  );
}

type WaThread = {
  name: string;
  preview: string;
  time: string;
  unread?: boolean;
  needsReply?: boolean;
  avatar?: string;
};

const LIVE_WA_THREADS: WaThread[] = [
  {
    name: "Thandi M.",
    preview: "Can I move my slot to Saturday morning?",
    time: "2m",
    unread: true,
    needsReply: true,
    avatar: "TM",
  },
  {
    name: "Lindiwe N.",
    preview: "1",
    time: "5m",
    unread: true,
    avatar: "LN",
  },
  {
    name: "+27 82 ••• 4412",
    preview: "Hi — do you do kids cuts? Price list?",
    time: "11m",
    unread: true,
    needsReply: true,
    avatar: "?",
  },
  {
    name: "Sipho D.",
    preview: "Yes, confirm ✓ Booking saved",
    time: "28m",
    avatar: "SD",
  },
];

/** Solupair Live Pulse — owner dashboard with WhatsApp inbox. */
export function LivePulseDashboardPreview() {
  const reduce = useReducedMotion();

  return (
    <ShowcaseFrame surface="light">
      <WindowDots title="dashboard.solupair.co.za — Live Pulse" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-[26%] shrink-0 flex-col border-r border-black/[0.06] bg-[oklch(0.985_0.008_285)] p-2.5 sm:flex">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.52_0.24_275)] to-[oklch(0.58_0.20_330)] text-[9px] font-black text-white">
              SP
            </div>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold text-black/80">Bontle-Entle</p>
              <p className="truncate text-[8px] text-black/45">Mmaki Malepe · Owner</p>
            </div>
          </div>
          <div className="mb-2.5 rounded-lg border border-black/[0.06] bg-white px-2.5 py-2 text-[9px] text-black/35">
            Search pages…
          </div>
          {[
            { label: "Today at a glance", badge: null },
            { label: "Bookings", badge: "4" },
            { label: "Live Pulse", badge: null, active: true },
            { label: "Inbox", badge: "3" },
            { label: "Clients", badge: null },
          ].map((item) => (
            <div
              key={item.label}
              className={`mb-1 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[9px] font-medium sm:text-[10px] ${
                item.active
                  ? "bg-[oklch(0.93_0.05_285)] font-semibold text-[oklch(0.40_0.24_275)]"
                  : "text-black/50"
              }`}
            >
              <span>{item.label}</span>
              {item.badge && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[7px] font-bold text-white sm:text-[8px]">
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[oklch(0.99_0.004_270)] p-3 sm:p-3.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-xs font-bold text-black/85 sm:text-sm">Live Pulse</p>
            <div className="flex items-center gap-2 text-[9px] sm:text-[10px]">
              <span className="rounded-lg bg-emerald-50 px-2 py-1 font-bold text-emerald-700">
                Today R 6,240
              </span>
              <span className="flex items-center gap-1 rounded-lg bg-black/[0.04] px-2 py-1 font-semibold text-black/55">
                <Calendar className="size-3" />
                11 bookings
              </span>
            </div>
          </div>

          <motion.div
            className="mb-3 rounded-xl border border-[oklch(0.86_0.06_200)] bg-gradient-to-r from-[oklch(0.97_0.03_200)] to-white p-2.5 shadow-sm sm:p-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.45 }}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[oklch(0.58_0.16_200)] text-white">
                <Radio className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-black/80 sm:text-[11px]">Floor status — live</p>
                <p className="text-[8px] leading-snug text-black/45 sm:text-[9px]">
                  Next arrival <strong className="text-black/70">Nomsa P.</strong> in{" "}
                  <strong className="text-[oklch(0.48_0.18_240)]">8 min</strong> · Chair 2
                </p>
              </div>
              <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[8px] font-bold text-emerald-700 sm:text-[9px]">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
          </motion.div>

          <p className="mb-1.5 text-[8px] font-bold uppercase tracking-wider text-black/45 sm:text-[9px]">
            Right now
          </p>
          <div className="mb-3 grid grid-cols-5 gap-1.5 sm:gap-2">
            {[
              { label: "In chair", value: "3", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
              { label: "Idle", value: "6", color: "text-black/75", bg: "bg-white border-black/[0.06]" },
              { label: "Arriving", value: "2", color: "text-sky-700", bg: "bg-sky-50 border-sky-100" },
              { label: "Pay hold", value: "1", color: "text-amber-700", bg: "bg-amber-50 border-amber-100" },
              { label: "Chats", value: "4", color: "text-violet-700", bg: "bg-violet-50 border-violet-100", dot: true },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                className={`relative rounded-xl border px-1.5 py-2 text-center sm:px-2 ${m.bg}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduce ? 0 : i * 0.04 }}
              >
                {m.dot && (
                  <span className="absolute right-1 top-1 size-2 rounded-full bg-rose-500 ring-2 ring-white" />
                )}
                <p className={`text-sm font-black tabular-nums sm:text-base ${m.color}`}>{m.value}</p>
                <p className="text-[7px] font-bold uppercase tracking-wide text-black/40 sm:text-[8px]">{m.label}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
            <div className="flex min-h-0 flex-col rounded-xl border border-black/[0.07] bg-white p-2.5 shadow-sm sm:p-3">
              <p className="mb-2 text-[10px] font-bold text-black/70 sm:text-[11px]">Stations</p>
              <div className="flex flex-col gap-1.5">
                {[
                  { name: "Alice", state: "In chair", detail: "Nomsa · Balayage · R 890", tone: "bg-emerald-50 text-emerald-800 border-emerald-100" },
                  { name: "Bob", state: "Idle", detail: "Open · next 11:30", tone: "bg-black/[0.03] text-black/55 border-black/[0.06]" },
                  { name: "Peter", state: "Arriving", detail: "Lerato · 10:45 · Cut & colour", tone: "bg-sky-50 text-sky-800 border-sky-100" },
                ].map((station) => (
                  <div
                    key={station.name}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${station.tone}`}
                  >
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-[8px] font-bold shadow-sm">
                      <User className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold sm:text-[11px]">{station.name}</span>
                        <span className="text-[8px] font-bold uppercase sm:text-[9px]">{station.state}</span>
                      </div>
                      <p className="truncate text-[8px] font-medium opacity-80 sm:text-[9px]">{station.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex min-h-0 flex-col rounded-xl border border-black/[0.07] bg-white p-2.5 shadow-sm sm:p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-black/70 sm:text-[11px]">WhatsApp inbox</p>
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[8px] font-bold text-white sm:text-[9px]">
                  3 need reply
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                {LIVE_WA_THREADS.map((thread, i) => (
                  <motion.div
                    key={thread.name + thread.time}
                    className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${
                      thread.unread
                        ? "border-[oklch(0.88_0.06_285)] bg-[oklch(0.98_0.02_285)]"
                        : "border-black/[0.05] bg-[oklch(0.995_0.004_270)]"
                    }`}
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: reduce ? 0 : 0.15 + i * 0.06 }}
                  >
                    <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-[oklch(0.55_0.18_145)] text-[8px] font-bold text-white">
                      {thread.avatar}
                      {thread.unread && (
                        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`truncate text-[10px] sm:text-[11px] ${thread.unread ? "font-bold text-black/85" : "font-semibold text-black/60"}`}>
                          {thread.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-0.5 text-[8px] text-black/40 sm:text-[9px]">
                          <Clock className="size-2.5" />
                          {thread.time}
                        </span>
                      </div>
                      <p className={`truncate text-[9px] sm:text-[10px] ${thread.unread ? "font-medium text-black/65" : "text-black/45"}`}>
                        {thread.preview}
                      </p>
                      {thread.needsReply && (
                        <span className="mt-1 inline-block rounded-md bg-amber-100 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-amber-800 sm:text-[8px]">
                          Needs reply
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
              <button
                type="button"
                className="mt-2 w-full rounded-lg bg-[oklch(0.48_0.24_275)] py-2 text-[9px] font-bold text-white sm:text-[10px]"
              >
                Open full inbox →
              </button>
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
      <div className="flex h-full max-h-[100%] w-full max-w-[260px] flex-col overflow-hidden rounded-[1.85rem] border border-white/10 bg-[#0b141a] shadow-[0_24px_70px_oklch(0_0_0_/_0.55)] sm:max-w-[300px]">
        <div className="flex items-center justify-between px-4 pt-2.5 text-[9px] text-white/50 sm:text-[10px]">
          <span>9:41</span>
          <div className="mx-auto h-5 w-[4.5rem] rounded-full bg-black/80" />
          <span className="font-medium">5G</span>
        </div>

        <div className="flex items-center gap-2.5 border-b border-white/5 bg-[#1f2c34] px-3 py-2.5">
          <div className="flex size-9 items-center justify-center rounded-full bg-[#25D366]/20 text-[11px] font-bold text-[#25D366]">
            {DEMO_SALON_NAME.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-white sm:text-xs">{DEMO_SALON_NAME}</p>
            <p className="text-[9px] text-emerald-400 sm:text-[10px]">online · typically replies instantly</p>
          </div>
          <Zap className="size-4 text-primary" aria-hidden />
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-3"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        >
          <ChatBubble from="bot" delay={0} text={demoNewCustomerGreeting} time="09:12" />
          <ChatBubble from="bot" delay={0.08} text={demoMainMenuBody()} time="09:12" />
          <ChatBubble from="user" delay={0.18} text="1" time="09:13 ✓✓" />
          <ChatBubble from="bot" delay={0.28} text={demoPickServiceBody} time="09:13" />
          <ChatBubble from="user" delay={0.38} text="1" time="09:14 ✓✓" />
          <ChatBubble from="bot" delay={0.48} text={demoPickSlotBody} time="09:14" />
          <ChatBubble from="user" delay={0.58} text="1" time="09:14 ✓✓" />
          <ChatBubble from="bot" delay={0.68} text={demoConfirmBookingBody} time="09:14" />
          <ChatBubble from="user" delay={0.78} text="Yes, confirm" time="09:15 ✓✓" />
          <ChatBubble from="bot" delay={0.88} text={demoBookingConfirmedBody} time="09:15" />

          {!reduce && (
            <motion.div
              className="flex shrink-0 justify-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.35, 0.9, 0.35] }}
              transition={{ delay: 1.1, duration: 1.6, repeat: Infinity }}
            >
              <div className="flex gap-1 rounded-2xl rounded-tl-md bg-[#202c33] px-3.5 py-2.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="size-1.5 rounded-full bg-white/45"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ delay: i * 0.2, duration: 0.8, repeat: Infinity }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-white/5 bg-[#1f2c34] px-2.5 py-2.5">
          <div className="h-9 flex-1 rounded-full bg-[#2a3942] px-4 text-[10px] leading-9 text-white/35">
            Message
          </div>
          <div className="flex size-9 items-center justify-center rounded-full bg-[#25D366] text-[#0b141a]">
            <MessageCircle className="size-4" />
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

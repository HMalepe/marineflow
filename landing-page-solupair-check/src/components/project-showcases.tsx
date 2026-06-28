import type { ComponentType } from "react";
import expiryDeskShot from "@/assets/project-expiry-desk.png";
import livePulseShot from "@/assets/project-live-pulse.png";
import whatsappAgentShot from "@/assets/project-whatsapp-agent.png";

function ScreenshotPreview({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[oklch(0.08_0.01_260)]">
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover object-top"
        loading="lazy"
        decoding="async"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
    </div>
  );
}

function makeScreenshotPreview(src: string, alt: string): ComponentType {
  return function ScreenshotSlide() {
    return <ScreenshotPreview src={src} alt={alt} />;
  };
}

export const PROJECT_SHOWCASES = [
  {
    id: "expiry-desk",
    name: "ExpiryDesk Dashboard",
    tag: "Pharmacy inventory · expiry tracking",
    Preview: makeScreenshotPreview(
      expiryDeskShot,
      "ExpiryDesk Pro dashboard showing write-offs, at-risk stock, and inventory lines",
    ),
  },
  {
    id: "live-pulse",
    name: "Live Pulse",
    tag: "Solupair · WhatsApp booking engine",
    Preview: makeScreenshotPreview(
      livePulseShot,
      "Solupair owner dashboard Live Pulse page with floor counts and station status",
    ),
  },
  {
    id: "whatsapp-agent",
    name: "WhatsApp Agent",
    tag: "MarineFlow booking bot",
    Preview: makeScreenshotPreview(
      whatsappAgentShot,
      "WhatsApp booking agent conversation for salon appointments",
    ),
  },
] as const;

import { createFileRoute } from "@tanstack/react-router";
import { PricingPageContent } from "@/components/pricing-page";
import { SiteHeader } from "@/components/site-header";
import { SITE_URL } from "@/lib/site-seo";

const PRICING_DESCRIPTION =
  "Indicative starting estimates for Solupair websites, dashboards and automation builds. Every project is quoted individually after discovery.";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing estimates — Solupair" },
      { name: "description", content: PRICING_DESCRIPTION },
      { property: "og:title", content: "Pricing estimates — Solupair" },
      { property: "og:description", content: PRICING_DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/pricing` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/pricing` }],
  }),
});

function PricingPage() {
  return (
    <main className="pricing-page min-h-[100dvh] bg-background font-sans text-foreground">
      <div className="pricing-direction pricing-page-shell relative isolate min-h-[100dvh] overflow-x-clip">
        <div className="pricing-direction-glow pricing-direction-glow--left" aria-hidden />
        <div className="pricing-direction-glow pricing-direction-glow--right" aria-hidden />
        <SiteHeader sticky />
        <PricingPageContent />
      </div>
    </main>
  );
}

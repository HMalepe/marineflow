import { Link } from "@tanstack/react-router";
import solupairLogo from "@/assets/solupair-logo.png";
import solupairWordmark from "@/assets/solupair-wordmark.png";

type SiteHeaderProps = {
  /** Sticky bar for inner pages (pricing, etc.) */
  sticky?: boolean;
};

function SolupairLogo() {
  return (
    <Link
      to="/"
      className="site-logo inline-flex min-w-0 flex-row items-center gap-2 sm:gap-3 lg:gap-4"
      aria-label="Solupair home"
    >
      <img
        src={solupairLogo}
        alt=""
        aria-hidden
        width={1536}
        height={1206}
        decoding="async"
        className="site-logo-mark w-auto shrink-0 object-contain object-left"
      />
      <div className="site-logo-wordmark-wrap site-logo-wordmark-wrap--desktop overflow-hidden">
        <img
          src={solupairWordmark}
          alt="Solupair"
          width={1600}
          height={153}
          decoding="async"
          className="site-logo-wordmark h-full w-auto object-contain object-left object-top"
        />
      </div>
    </Link>
  );
}

export function SiteHeader({ sticky = false }: SiteHeaderProps) {
  return (
    <header
      className={`site-header safe-area-top relative z-50 w-full overflow-x-clip${sticky ? " site-header--sticky" : ""}`}
    >
      <div className="site-header-bar">
        <div className="site-header-inner">
          <SolupairLogo />
          <nav className="site-nav" aria-label="Primary">
            <a href="/#work" className="site-nav-link site-nav-link--secondary">
              <span className="site-nav-label site-nav-label--short">Work</span>
              <span className="site-nav-label site-nav-label--full">Projects</span>
            </a>
            <Link
              to="/pricing"
              className="site-nav-link site-nav-link--secondary"
              activeProps={{
                className: "site-nav-link site-nav-link--secondary site-nav-link--active",
              }}
            >
              <span className="site-nav-label site-nav-label--short">Price</span>
              <span className="site-nav-label site-nav-label--full">Pricing</span>
            </Link>
            <a href="/#contact" className="site-nav-link site-nav-link--primary">
              <span className="site-nav-label site-nav-label--short">Start</span>
              <span className="site-nav-label site-nav-label--full">Start a project</span>
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}

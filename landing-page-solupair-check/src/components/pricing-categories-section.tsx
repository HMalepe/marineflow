import {
  PRICING_CATEGORIES,
  PRICING_CATEGORY_INTRO,
} from "@/lib/pricing-categories";

export function PricingCategoriesSection() {
  return (
    <section
      className="pricing-categories"
      aria-labelledby="pricing-categories-heading"
    >
      <header className="pricing-categories__header">
        <p className="pricing-page-eyebrow pricing-reveal pricing-reveal--heading">
          Solutions by business type
        </p>
        <h2
          id="pricing-categories-heading"
          className="pricing-categories__heading pricing-reveal pricing-reveal--heading font-display font-black uppercase tracking-tighter text-foreground"
        >
          {PRICING_CATEGORY_INTRO.heading}
        </h2>
        <p className="pricing-categories__body pricing-reveal pricing-reveal--subtitle">
          {PRICING_CATEGORY_INTRO.body}
        </p>
      </header>

      <ul className="pricing-categories__chips" aria-label="Business types we often work with">
        {PRICING_CATEGORY_INTRO.chips.map((label, index) => (
          <li
            key={label}
            className="pricing-categories__chip-item pricing-reveal pricing-reveal--chip"
            style={{ animationDelay: `${0.2 + index * 0.05}s` }}
          >
            <span className="pricing-categories__chip">{label}</span>
          </li>
        ))}
      </ul>

      <p className="pricing-categories__sector-note pricing-reveal pricing-reveal--subtitle">
        Estimate sheet below — not a gallery of case studies. Figures are generalisations; your
        quote is confirmed after discovery.
      </p>

      <div
        className="pricing-categories__table-wrap pricing-reveal pricing-reveal--card"
        role="region"
        aria-label="Sector pricing summary table"
      >
        <table className="pricing-categories__table">
          <caption className="pricing-categories__table-caption">
            Indicative setup, monthly and year-one estimates by business category
          </caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Setup (est.)</th>
              <th scope="col">Monthly (est.)</th>
              <th scope="col">Year-one guide (est.)</th>
            </tr>
          </thead>
          <tbody>
            {PRICING_CATEGORIES.map((category) => (
              <tr key={category.id}>
                <th scope="row">{category.label}</th>
                <td>{category.setupEstimate}</td>
                <td>{category.monthlyEstimate}</td>
                <td>{category.yearOneGuide}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="pricing-categories__table-note">
          Year-one guide = setup plus twelve months at the mid-range monthly estimate, rounded for
          orientation. Not a fixed package or invoice.
        </p>
      </div>

      <div className="pricing-categories__breakdown" aria-label="Sector estimate breakdown">
        {PRICING_CATEGORIES.map((category, index) => (
          <section
            key={category.id}
            className="pricing-category-row pricing-reveal pricing-reveal--card"
            style={{ animationDelay: `${0.18 + index * 0.06}s` }}
            aria-labelledby={`pricing-category-${category.id}`}
          >
            <div className="pricing-category-row__main">
              <h3 id={`pricing-category-${category.id}`} className="pricing-category-row__title">
                {category.label}
              </h3>
              <p className="pricing-category-row__summary">{category.summary}</p>

              <div className="pricing-category-row__solutions">
                <p className="pricing-category-row__solutions-label">What we typically build</p>
                <ul>
                  {category.solutions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pricing-category-row__figures">
              <dl className="pricing-category-row__costs">
                <div className="pricing-category-row__cost">
                  <dt>Once-off setup</dt>
                  <dd>
                    {category.setupEstimate}
                    <span className="pricing-category-row__est"> est.</span>
                  </dd>
                </div>
                <div className="pricing-category-row__cost">
                  <dt>Typical monthly</dt>
                  <dd>
                    {category.monthlyEstimate}
                    <span className="pricing-category-row__est"> est.</span>
                  </dd>
                </div>
                <div className="pricing-category-row__cost pricing-category-row__cost--total">
                  <dt>Year-one guide</dt>
                  <dd>
                    {category.yearOneGuide}
                    <span className="pricing-category-row__est"> est.</span>
                  </dd>
                </div>
              </dl>
              <p className="pricing-category-row__monthly-note">{category.monthlyNote}</p>
              <p className="pricing-category-row__footnote">
                Indicative only — may be lower or higher depending on scope and integrations.
              </p>
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

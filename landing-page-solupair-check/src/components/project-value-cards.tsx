import { PROJECT_SHOWCASES } from "@/components/project-showcases";

type ProjectValueCardsProps = {
  activeIndex: number;
  onSelect: (index: number) => void;
};

const TAG_ACCENTS = ["cyan", "purple", "magenta"] as const;

export function ProjectValueCards({ activeIndex, onSelect }: ProjectValueCardsProps) {
  return (
    <ul className="projects-value-cards" aria-label="Project highlights">
      {PROJECT_SHOWCASES.map((project, index) => (
        <li
          key={project.id}
          className={`projects-value-cards__item${index !== activeIndex ? " projects-value-cards__item--compact" : ""}`}
        >
          <button
            type="button"
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => onSelect(index)}
            className={`projects-value-card projects-reveal projects-reveal--value-card projects-value-card--${TAG_ACCENTS[index % TAG_ACCENTS.length]} ${
              index === activeIndex ? "projects-value-card--active" : ""
            }`}
            style={{ animationDelay: `${0.28 + index * 0.1}s` }}
          >
            <span className="projects-value-card__tag">{project.valueTag}</span>
            <span className="projects-value-card__title">{project.cardTitle}</span>
            <p className="projects-value-card__desc">{project.valueDescription}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}

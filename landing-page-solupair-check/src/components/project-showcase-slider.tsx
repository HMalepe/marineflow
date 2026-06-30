import { forwardRef, useImperativeHandle, useRef, type ComponentType } from "react";

export type ShowcaseSliderHandle = {
  transitionTo: (index: number) => void;
  getActiveIndex: () => number;
};

type Slide = {
  id: string;
  Preview: ComponentType;
};

type ProjectShowcaseSliderProps = {
  slides: readonly Slide[];
  activeIndex: number;
  className?: string;
};

export const ProjectShowcaseSlider = forwardRef<
  ShowcaseSliderHandle,
  ProjectShowcaseSliderProps
>(function ProjectShowcaseSlider({ slides, activeIndex, className }, ref) {
  const indexRef = useRef(activeIndex);
  indexRef.current = activeIndex;

  useImperativeHandle(ref, () => ({
    getActiveIndex: () => indexRef.current,
    transitionTo: () => {
      /* controlled via activeIndex prop */
    },
  }));

  return (
    <div className={className} style={{ touchAction: "pan-y" }}>
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`project-showcase-slide ${index === activeIndex ? "is-active" : ""}`}
          aria-hidden={index !== activeIndex}
        >
          <slide.Preview />
        </div>
      ))}
    </div>
  );
});

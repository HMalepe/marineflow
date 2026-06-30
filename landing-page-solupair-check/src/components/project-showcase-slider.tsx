import Fade from "embla-carousel-fade";
import useEmblaCarousel from "embla-carousel-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { useDeviceProfile } from "@/hooks/use-device-profile";

export type ShowcaseSliderHandle = {
  scrollTo: (index: number) => void;
  scrollPrev: () => void;
  scrollNext: () => void;
  getSelectedIndex: () => number;
};

export type ShowcaseCarouselState = {
  index: number;
  canScrollPrev: boolean;
  canScrollNext: boolean;
};

type Slide = {
  id: string;
  name: string;
  cardTitle: string;
  Preview: ComponentType<{ isActive?: boolean }>;
};

type ProjectShowcaseSliderProps = {
  slides: readonly Slide[];
  onSelect?: (state: ShowcaseCarouselState) => void;
  className?: string;
};

export const ProjectShowcaseSlider = forwardRef<
  ShowcaseSliderHandle,
  ProjectShowcaseSliderProps
>(function ProjectShowcaseSlider({ slides, onSelect, className }, ref) {
  const { prefersReducedMotion } = useDeviceProfile();
  const plugins = useMemo(
    () => (prefersReducedMotion ? [] : [Fade()]),
    [prefersReducedMotion],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: false,
      align: "start",
      containScroll: "trimSnaps",
      duration: prefersReducedMotion ? 0 : 32,
      watchDrag: true,
    },
    plugins,
  );

  const [selectedIndex, setSelectedIndex] = useState(0);

  const syncCarouselState = useCallback(() => {
    if (!emblaApi) return;
    const index = emblaApi.selectedScrollSnap();
    setSelectedIndex(index);
    onSelect?.({
      index,
      canScrollPrev: emblaApi.canScrollPrev(),
      canScrollNext: emblaApi.canScrollNext(),
    });
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!emblaApi) return;
    syncCarouselState();
    emblaApi.on("select", syncCarouselState);
    emblaApi.on("reInit", syncCarouselState);
    return () => {
      emblaApi.off("select", syncCarouselState);
      emblaApi.off("reInit", syncCarouselState);
    };
  }, [emblaApi, syncCarouselState]);

  useImperativeHandle(
    ref,
    () => ({
      scrollTo: (index: number) => emblaApi?.scrollTo(index),
      scrollPrev: () => emblaApi?.scrollPrev(),
      scrollNext: () => emblaApi?.scrollNext(),
      getSelectedIndex: () => emblaApi?.selectedScrollSnap() ?? selectedIndex,
    }),
    [emblaApi, selectedIndex],
  );

  return (
    <div className={className}>
      <div
        ref={emblaRef}
        className={`projects-embla projects-embla--fade h-full overflow-hidden rounded-[inherit]${prefersReducedMotion ? " projects-embla--reduced" : ""}`}
      >
        <div className="projects-embla__container">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className="projects-embla__slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`${slide.cardTitle} showcase`}
              aria-hidden={index !== selectedIndex}
              inert={index !== selectedIndex ? true : undefined}
            >
              <div className="projects-embla__slide-inner">
                <slide.Preview isActive={index === selectedIndex} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        Showing {slides[selectedIndex]?.cardTitle ?? "project"} — slide {selectedIndex + 1} of{" "}
        {slides.length}
      </span>
    </div>
  );
});

export type { Slide as ShowcaseSlide };

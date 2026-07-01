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

type SliderEngineProps = ProjectShowcaseSliderProps & {
  useFade: boolean;
};

const ProjectShowcaseSliderEngine = forwardRef<ShowcaseSliderHandle, SliderEngineProps>(
  function ProjectShowcaseSliderEngine({ slides, onSelect, className, useFade }, ref) {
    const { prefersReducedMotion } = useDeviceProfile();
    const plugins = useMemo(() => (useFade ? [Fade()] : []), [useFade]);

    const [emblaRef, emblaApi] = useEmblaCarousel(
      {
        loop: true,
        align: "start",
        containScroll: "trimSnaps",
        duration: useFade ? 0 : prefersReducedMotion ? 0 : 24,
        watchDrag: true,
      },
      plugins,
    );

    const [selectedIndex, setSelectedIndex] = useState(0);

    const applySelectedSlideVisibility = useCallback(
      (index: number) => {
        if (!emblaApi || !useFade) return;
        const { dragHandler, slideRegistry } = emblaApi.internalEngine();
        if (dragHandler.pointerDown()) return;

        const slidesInSnap = slideRegistry[index] ?? [index];
        emblaApi.slideNodes().forEach((node, slideIndex) => {
          const visible = slidesInSnap.includes(slideIndex);
          node.style.opacity = visible ? "1" : "0";
          node.style.pointerEvents = visible ? "auto" : "none";
        });
      },
      [emblaApi, useFade],
    );

    const syncCarouselState = useCallback(() => {
      if (!emblaApi) return;
      const index = emblaApi.selectedScrollSnap();
      setSelectedIndex(index);
      applySelectedSlideVisibility(index);
      onSelect?.({
        index,
        canScrollPrev: emblaApi.canScrollPrev(),
        canScrollNext: emblaApi.canScrollNext(),
      });
    }, [applySelectedSlideVisibility, emblaApi, onSelect]);

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

    const emblaModeClass = useFade
      ? "projects-embla--fade"
      : prefersReducedMotion
        ? "projects-embla--reduced"
        : "projects-embla--scroll";

    return (
      <div className={className}>
        <div
          ref={emblaRef}
          className={`projects-embla ${emblaModeClass} h-full overflow-hidden rounded-[inherit]`}
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
  },
);

export const ProjectShowcaseSlider = forwardRef<ShowcaseSliderHandle, ProjectShowcaseSliderProps>(
  function ProjectShowcaseSlider(props, ref) {
    const { prefersReducedMotion, isMobileLanding } = useDeviceProfile();
    const useFade = !prefersReducedMotion && !isMobileLanding;

    return (
      <ProjectShowcaseSliderEngine
        key={useFade ? "fade" : "scroll"}
        ref={ref}
        {...props}
        useFade={useFade}
      />
    );
  },
);

export type { Slide as ShowcaseSlide };

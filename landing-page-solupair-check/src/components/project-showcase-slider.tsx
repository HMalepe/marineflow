import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ComponentType,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

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

  const slide = slides[activeIndex];
  if (!slide) return null;

  return (
    <div className={className} style={{ touchAction: "pan-y" }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={slide.id}
          className="absolute inset-0 overflow-hidden rounded-[inherit]"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <slide.Preview />
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

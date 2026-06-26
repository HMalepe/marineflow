import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  varying vec2 vUv;
  uniform sampler2D currentImage;
  uniform sampler2D nextImage;
  uniform float dispFactor;
  uniform vec2 imageScale;

  vec2 coverUv(vec2 uv) {
    return (uv - 0.5) * imageScale + 0.5;
  }

  void main() {
    vec2 uv = coverUv(vUv);
    float intensity = 0.3;

    vec4 orig1 = texture2D(currentImage, uv);
    vec4 orig2 = texture2D(nextImage, uv);

    vec4 current = texture2D(
      currentImage,
      vec2(uv.x, uv.y + dispFactor * (orig2 * intensity))
    );
    vec4 next = texture2D(
      nextImage,
      vec2(uv.x, uv.y + (1.0 - dispFactor) * (orig1 * intensity))
    );

    gl_FragColor = mix(current, next, dispFactor);
  }
`;

function getCoverScale(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
) {
  const containerAspect = containerWidth / containerHeight;
  const imageAspect = imageWidth / imageHeight;

  if (containerAspect > imageAspect) {
    return {
      x: 1,
      y: containerAspect / imageAspect,
    };
  }

  return {
    x: imageAspect / containerAspect,
    y: 1,
  };
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

const TRANSITION_MS = 340;

export type DistortionSliderHandle = {
  transitionTo: (index: number) => void;
  getActiveIndex: () => number;
};

type DistortionProjectSliderProps = {
  images: string[];
  className?: string;
};

export const DistortionProjectSlider = forwardRef<
  DistortionSliderHandle,
  DistortionProjectSliderProps
>(function DistortionProjectSlider({ images, className }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const transitionRef = useRef<((index: number) => void) | null>(null);
  const activeIndexRef = useRef(0);
  const [isReady, setIsReady] = useState(false);

  useImperativeHandle(ref, () => ({
    getActiveIndex: () => activeIndexRef.current,
    transitionTo: (index: number) => {
      transitionRef.current?.(index);
    },
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container || images.length === 0) return;

    let disposed = false;
    let renderer: import("three").WebGLRenderer | null = null;
    let transitionFrame = 0;
    let resizeObserver: ResizeObserver | null = null;

    const boot = async () => {
      const THREE = await import("three");
      if (disposed || !container) return;

      const loader = new THREE.TextureLoader();
      const textures = await Promise.all(
        images.map(
          (src) =>
            new Promise<import("three").Texture>((resolve, reject) => {
              loader.load(src, resolve, undefined, reject);
            }),
        ),
      );

      if (disposed || !container) {
        textures.forEach((texture) => texture.dispose());
        return;
      }

      textures.forEach((texture) => {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
      });

      const firstImage = textures[0]?.image as HTMLImageElement | undefined;
      const imageWidth = firstImage?.naturalWidth ?? firstImage?.width ?? 1;
      const imageHeight = firstImage?.naturalHeight ?? firstImage?.height ?? 1;

      let activeIndex = 0;
      let isAnimating = false;
      let transitionStart = 0;
      let transitionFromFactor = 0;

      const getSize = () => ({
        width: Math.max(1, container.clientWidth),
        height: Math.max(1, container.clientHeight),
      });

      const { width, height } = getSize();

      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height, false);
      renderer.domElement.className =
        "absolute inset-0 h-full w-full rounded-[inherit]";
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(
        width / -2,
        width / 2,
        height / 2,
        height / -2,
        0.1,
        10,
      );
      camera.position.z = 1;

      const material = new THREE.ShaderMaterial({
        uniforms: {
          dispFactor: { value: 0 },
          currentImage: { value: textures[0] },
          nextImage: { value: textures[Math.min(1, textures.length - 1)] },
          imageScale: {
            value: new THREE.Vector2(1, 1),
          },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
      });

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        material,
      );
      scene.add(mesh);

      const renderScene = () => {
        renderer?.render(scene, camera);
      };

      const commitPartialTransition = () => {
        if (material.uniforms.dispFactor.value >= 0.5) {
          const committed = material.uniforms.nextImage.value;
          material.uniforms.currentImage.value = committed;
          const committedIndex = textures.indexOf(committed);
          if (committedIndex >= 0) {
            activeIndex = committedIndex;
            activeIndexRef.current = committedIndex;
          }
        }
        material.uniforms.dispFactor.value = 0;
      };

      const finishTransition = (targetIndex: number) => {
        activeIndex = targetIndex;
        activeIndexRef.current = targetIndex;
        material.uniforms.currentImage.value = textures[targetIndex];
        material.uniforms.dispFactor.value = 0;
        isAnimating = false;
        renderScene();
      };

      const runTransition = (targetIndex: number) => {
        if (targetIndex < 0 || targetIndex >= textures.length) return;
        if (targetIndex === activeIndex && !isAnimating) return;

        cancelAnimationFrame(transitionFrame);

        if (isAnimating) {
          commitPartialTransition();
        }

        if (targetIndex === activeIndex) {
          isAnimating = false;
          renderScene();
          return;
        }

        isAnimating = true;
        transitionFromFactor = material.uniforms.dispFactor.value;
        material.uniforms.nextImage.value = textures[targetIndex];
        transitionStart = performance.now();

        const tick = (now: number) => {
          if (disposed) return;

          const progress = Math.min(1, (now - transitionStart) / TRANSITION_MS);
          const eased = easeOutCubic(progress);
          material.uniforms.dispFactor.value =
            transitionFromFactor + (1 - transitionFromFactor) * eased;
          renderScene();

          if (progress < 1) {
            transitionFrame = requestAnimationFrame(tick);
            return;
          }

          finishTransition(targetIndex);
        };

        transitionFrame = requestAnimationFrame(tick);
      };

      transitionRef.current = runTransition;

      const resize = () => {
        const next = getSize();
        const cover = getCoverScale(
          next.width,
          next.height,
          imageWidth,
          imageHeight,
        );
        material.uniforms.imageScale.value.set(cover.x, cover.y);

        renderer?.setSize(next.width, next.height, false);
        camera.left = next.width / -2;
        camera.right = next.width / 2;
        camera.top = next.height / 2;
        camera.bottom = next.height / -2;
        camera.updateProjectionMatrix();

        mesh.geometry.dispose();
        mesh.geometry = new THREE.PlaneGeometry(next.width, next.height);
        renderScene();
      };

      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
      setIsReady(true);
      renderScene();

      return () => {
        transitionRef.current = null;
        resizeObserver?.disconnect();
        cancelAnimationFrame(transitionFrame);
        mesh.geometry.dispose();
        material.dispose();
        textures.forEach((texture) => texture.dispose());
        renderer?.dispose();
        if (renderer?.domElement.parentElement === container) {
          container.removeChild(renderer.domElement);
        }
      };
    };

    let cleanup: (() => void) | undefined;
    void boot().then((disposeBoot) => {
      cleanup = disposeBoot;
    });

    return () => {
      disposed = true;
      setIsReady(false);
      cleanup?.();
    };
  }, [images]);

  return (
    <div ref={containerRef} className={className}>
      <img
        src={images[activeIndexRef.current] ?? images[0]}
        alt=""
        aria-hidden
        className={`absolute inset-0 h-full w-full rounded-[inherit] object-cover transition-opacity duration-150 ${
          isReady ? "opacity-0" : "opacity-100"
        }`}
      />
    </div>
  );
});

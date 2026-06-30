import { useEffect, useRef } from "react";
import { useDeviceProfile } from "@/hooks/use-device-profile";

const BRAND = {
  cyan: 0x22e6f2,
  pink: 0xff4fd8,
  purple: 0x6b35ff,
} as const;

type HelixConfig = {
  strandCount: number;
  pointsPerStrand: number;
  sphereRadius: number;
  sphereSegments: number;
  spanX: number;
};

function getHelixConfig(isPhone: boolean, isTablet: boolean): HelixConfig {
  if (isPhone) {
    return {
      strandCount: 13,
      pointsPerStrand: 64,
      sphereRadius: 0.034,
      sphereSegments: 8,
      spanX: 18,
    };
  }
  if (isTablet) {
    return {
      strandCount: 17,
      pointsPerStrand: 78,
      sphereRadius: 0.042,
      sphereSegments: 9,
      spanX: 24,
    };
  }
  return {
    strandCount: 22,
    pointsPerStrand: 92,
    sphereRadius: 0.048,
    sphereSegments: 10,
    spanX: 28,
  };
}

function spanForViewport(baseSpan: number, width: number, height: number) {
  const aspectBoost = Math.max(1.2, width / Math.max(height, 1));
  const widthBoost = Math.max(1.15, width / 900);
  return baseSpan * aspectBoost * widthBoost;
}

function lerpChannel(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Animated 3D helix-wave particle field along the Contact footer. */
export function ContactHelixBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { prefersReducedMotion, isPhone, isTablet } = useDeviceProfile();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || prefersReducedMotion || isPhone) return;

    let disposed = false;
    let renderer: import("three").WebGLRenderer | null = null;
    let frameId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let activeSpanX = getHelixConfig(isPhone, isTablet).spanX;

    const boot = async () => {
      const THREE = await import("three");
      if (disposed || !container) return;

      const config = getHelixConfig(isPhone, isTablet);
      const totalInstances = config.strandCount * config.pointsPerStrand;

      const getSize = () => ({
        width: Math.max(1, container.clientWidth),
        height: Math.max(1, container.clientHeight),
      });

      const { width, height } = getSize();
      activeSpanX = spanForViewport(config.spanX, width, height);

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isPhone ? 1.4 : 2));
      renderer.setSize(width, height, false);
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.45;
      renderer.domElement.className = "contact-helix-canvas__gl";
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x07051c, 0.062);

      const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 50);
      camera.position.set(0, 0.48, 8.6);
      camera.lookAt(0, -0.55, 0);

      scene.add(new THREE.AmbientLight(0x241050, 0.55));

      const cyanLight = new THREE.PointLight(BRAND.cyan, 7.2, 30, 1.6);
      cyanLight.position.set(-9.5, 0.35, 4.8);
      scene.add(cyanLight);

      const pinkLight = new THREE.PointLight(BRAND.pink, 6.4, 30, 1.6);
      pinkLight.position.set(9.8, -0.05, 4.6);
      scene.add(pinkLight);

      const purpleLight = new THREE.PointLight(BRAND.purple, 4.6, 26, 1.6);
      purpleLight.position.set(0, -1.6, 3.8);
      scene.add(purpleLight);

      const geometry = new THREE.SphereGeometry(
        config.sphereRadius,
        config.sphereSegments,
        config.sphereSegments,
      );

      const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.12,
        metalness: 0.72,
        emissive: 0x12082e,
        emissiveIntensity: 0.95,
        clearcoat: 0.92,
        clearcoatRoughness: 0.12,
        transparent: true,
        opacity: 0.97,
        toneMapped: true,
      });

      const mesh = new THREE.InstancedMesh(geometry, material, totalInstances);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      const instanceColors = new Float32Array(totalInstances * 3);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(instanceColors, 3);

      const colorA = new THREE.Color().setHex(BRAND.cyan);
      const colorB = new THREE.Color().setHex(BRAND.purple);
      const colorC = new THREE.Color().setHex(BRAND.pink);
      const scratchColor = new THREE.Color();

      const strandMeta: Array<{ phase: number; amp: number; freq: number; twist: number }> = [];
      for (let s = 0; s < config.strandCount; s += 1) {
        const t = s / Math.max(1, config.strandCount - 1);
        strandMeta.push({
          phase: (s / config.strandCount) * Math.PI * 2,
          amp: lerpChannel(0.58, 1.02, 0.5 + 0.5 * Math.sin(t * Math.PI * 2)),
          freq: lerpChannel(3.6, 6.2, t),
          twist: lerpChannel(2, 3.6, 1 - t),
        });
      }

      const tempObject = new THREE.Object3D();
      const clock = new THREE.Clock();

      const writeInstance = (
        idx: number,
        x: number,
        y: number,
        z: number,
        scale: number,
        mix: number,
        glow: number,
      ) => {
        tempObject.position.set(x, y, z);
        tempObject.scale.setScalar(scale);
        tempObject.updateMatrix();
        mesh.setMatrixAt(idx, tempObject.matrix);

        if (mix < 0.5) {
          scratchColor.copy(colorA).lerp(colorB, mix / 0.5);
        } else {
          scratchColor.copy(colorB).lerp(colorC, (mix - 0.5) / 0.5);
        }

        instanceColors[idx * 3] = scratchColor.r * glow;
        instanceColors[idx * 3 + 1] = scratchColor.g * glow;
        instanceColors[idx * 3 + 2] = scratchColor.b * glow;
      };

      const updateInstances = (time: number) => {
        const flowOffset = time * 0.068;
        let idx = 0;

        for (let s = 0; s < config.strandCount; s += 1) {
          const meta = strandMeta[s];
          const strandT = s / Math.max(1, config.strandCount - 1);

          for (let p = 0; p < config.pointsPerStrand; p += 1) {
            const u = p / Math.max(1, config.pointsPerStrand - 1);
            const travel = ((u + flowOffset + s * 0.028) % 1) - 0.5;
            const x = travel * activeSpanX * 2.05;

            const wave =
              meta.amp *
              Math.sin(u * Math.PI * meta.freq + meta.phase + time * 1.02 + flowOffset * 6.2);
            const y =
              wave +
              0.28 * Math.sin(u * Math.PI * 10 + meta.phase + time * 0.78) -
              1.05 +
              strandT * 0.1;

            const z =
              meta.amp *
              1.05 *
              Math.cos(u * Math.PI * meta.twist + meta.phase + time * 0.62) *
              Math.sin(u * Math.PI * 2.8 + flowOffset * 4.2);

            const scale =
              0.86 +
              0.72 * Math.sin(u * Math.PI * 3.4 + meta.phase + time * 1.18 + flowOffset * 3.1);

            const edgeFade = 1 - Math.pow(Math.abs(travel) * 1.85, 2.4);
            const mix = strandT * 0.38 + ((travel / 0.5) + 0.5) * 0.62;
            const glow =
              (1.75 + 0.65 * Math.sin(u * Math.PI * 4.6 + meta.phase + time * 0.92)) *
              Math.max(0.35, edgeFade);

            writeInstance(idx, x, y, z, scale, Math.min(1, Math.max(0, mix)), glow);
            idx += 1;
          }
        }

        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor!.needsUpdate = true;
      };

      updateInstances(0);
      scene.add(mesh);

      const group = new THREE.Group();
      group.add(mesh);
      group.position.y = 0.08;
      group.rotation.x = -0.14;
      scene.add(group);

      const render = () => {
        if (disposed) return;
        const elapsed = clock.getElapsedTime();
        updateInstances(elapsed);

        group.rotation.y = Math.sin(elapsed * 0.18) * 0.08;
        group.rotation.z = Math.sin(elapsed * 0.11) * 0.025;
        group.position.y = 0.08 + Math.sin(elapsed * 0.32) * 0.06;

        cyanLight.intensity = 7.2 + Math.sin(elapsed * 1.05) * 0.85;
        pinkLight.intensity = 6.4 + Math.sin(elapsed * 1.22 + 1.2) * 0.75;
        purpleLight.intensity = 4.6 + Math.sin(elapsed * 0.88 + 0.6) * 0.55;

        renderer?.render(scene, camera);
        frameId = window.requestAnimationFrame(render);
      };

      const onResize = () => {
        if (!renderer || !container) return;
        const next = getSize();
        activeSpanX = spanForViewport(config.spanX, next.width, next.height);
        camera.aspect = next.width / next.height;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isPhone ? 1.4 : 2));
        renderer.setSize(next.width, next.height, false);
      };

      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(container);
      window.addEventListener("resize", onResize);

      render();

      return () => {
        disposed = true;
        window.cancelAnimationFrame(frameId);
        window.removeEventListener("resize", onResize);
        resizeObserver?.disconnect();

        geometry.dispose();
        material.dispose();
        mesh.dispose();
        renderer?.dispose();
        if (renderer?.domElement.parentElement === container) {
          container.removeChild(renderer.domElement);
        }
        renderer = null;
      };
    };

    let cleanup: (() => void) | undefined;
    boot().then((fn) => {
      cleanup = fn;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [isPhone, isTablet, prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      className="contact-helix-canvas"
      aria-hidden
    >
      {prefersReducedMotion || isPhone ? <div className="contact-helix-fallback" /> : null}
    </div>
  );
}

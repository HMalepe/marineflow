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
      strandCount: 11,
      pointsPerStrand: 58,
      sphereRadius: 0.032,
      sphereSegments: 8,
      spanX: 14.5,
    };
  }
  if (isTablet) {
    return {
      strandCount: 14,
      pointsPerStrand: 70,
      sphereRadius: 0.036,
      sphereSegments: 9,
      spanX: 16.5,
    };
  }
  return {
    strandCount: 18,
    pointsPerStrand: 84,
    sphereRadius: 0.04,
    sphereSegments: 10,
    spanX: 19,
  };
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
    if (!container || prefersReducedMotion) return;

    let disposed = false;
    let renderer: import("three").WebGLRenderer | null = null;
    let frameId = 0;
    let resizeObserver: ResizeObserver | null = null;

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

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isPhone ? 1.4 : 2));
      renderer.setSize(width, height, false);
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.domElement.className = "contact-helix-canvas__gl";
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x07051c, 0.085);

      const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 45);
      camera.position.set(0, 0.62, 7.4);
      camera.lookAt(0, -0.42, 0);

      scene.add(new THREE.AmbientLight(0x1a1040, 0.45));

      const cyanLight = new THREE.PointLight(BRAND.cyan, 5.5, 24, 1.8);
      cyanLight.position.set(-6.2, 0.2, 4.2);
      scene.add(cyanLight);

      const pinkLight = new THREE.PointLight(BRAND.pink, 4.8, 24, 1.8);
      pinkLight.position.set(6.4, -0.1, 4);
      scene.add(pinkLight);

      const purpleLight = new THREE.PointLight(BRAND.purple, 3.2, 20, 1.8);
      purpleLight.position.set(0, -1.4, 3.2);
      scene.add(purpleLight);

      const geometry = new THREE.SphereGeometry(
        config.sphereRadius,
        config.sphereSegments,
        config.sphereSegments,
      );

      const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.18,
        metalness: 0.62,
        emissive: 0x0a0820,
        emissiveIntensity: 0.65,
        clearcoat: 0.85,
        clearcoatRoughness: 0.18,
        transparent: true,
        opacity: 0.94,
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
          amp: lerpChannel(0.48, 0.82, 0.5 + 0.5 * Math.sin(t * Math.PI * 2)),
          freq: lerpChannel(3.4, 5.8, t),
          twist: lerpChannel(1.8, 3.1, 1 - t),
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
        const flowOffset = time * 0.052;
        let idx = 0;

        for (let s = 0; s < config.strandCount; s += 1) {
          const meta = strandMeta[s];
          const strandT = s / Math.max(1, config.strandCount - 1);

          for (let p = 0; p < config.pointsPerStrand; p += 1) {
            const u = p / Math.max(1, config.pointsPerStrand - 1);
            const travel = ((u + flowOffset + s * 0.035) % 1) - 0.5;
            const x = travel * config.spanX;

            const wave =
              meta.amp *
              Math.sin(u * Math.PI * meta.freq + meta.phase + time * 0.88 + flowOffset * 5.5);
            const y =
              wave +
              0.22 * Math.sin(u * Math.PI * 9 + meta.phase + time * 0.65) -
              1.18 +
              strandT * 0.08;

            const z =
              meta.amp *
              0.9 *
              Math.cos(u * Math.PI * meta.twist + meta.phase + time * 0.5) *
              Math.sin(u * Math.PI * 2.4 + flowOffset * 3.8);

            const scale =
              0.78 +
              0.62 * Math.sin(u * Math.PI * 3.2 + meta.phase + time * 1.05 + flowOffset * 2.8);

            const mix = strandT * 0.42 + ((travel / config.spanX) + 0.5) * 0.58;
            const glow = 1.55 + 0.55 * Math.sin(u * Math.PI * 4.2 + meta.phase + time * 0.8);

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
      group.position.y = 0.12;
      group.rotation.x = -0.18;
      scene.add(group);

      const render = () => {
        if (disposed) return;
        const elapsed = clock.getElapsedTime();
        updateInstances(elapsed);

        group.rotation.y = Math.sin(elapsed * 0.14) * 0.06;
        group.position.x = Math.sin(elapsed * 0.2) * 0.22;

        cyanLight.intensity = 5.5 + Math.sin(elapsed * 0.9) * 0.6;
        pinkLight.intensity = 4.8 + Math.sin(elapsed * 1.1 + 1.2) * 0.5;

        renderer?.render(scene, camera);
        frameId = window.requestAnimationFrame(render);
      };

      const onResize = () => {
        if (!renderer || !container) return;
        const next = getSize();
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
      {prefersReducedMotion ? <div className="contact-helix-fallback" /> : null}
    </div>
  );
}

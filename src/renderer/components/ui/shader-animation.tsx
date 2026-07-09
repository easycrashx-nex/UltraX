import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

type ShaderAnimationProps = {
  className?: string;
  disabled?: boolean;
  preset?: "ultrax-wave" | "blue-nebula" | "purple-flow" | "aurora-lines" | "calm-grid";
  speed?: "slow" | "normal" | "fast";
};

type SceneRefs = {
  renderer: THREE.WebGLRenderer;
  geometry: THREE.PlaneGeometry;
  material: THREE.ShaderMaterial;
  animationId: number;
};

export function ShaderAnimation({
  className,
  disabled = false,
  preset = "ultrax-wave",
  speed = "normal",
}: ShaderAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneRefs | null>(null);

  useEffect(() => {
    if (disabled || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `;

    const presetColor = getPresetColor(preset);
    const fragmentShader = `
      #define TWO_PI 6.2831853072
      #define PI 3.14159265359

      precision highp float;
      uniform vec2 resolution;
      uniform float time;

      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        float t = time * 0.05;
        float lineWidth = 0.002;

        vec3 color = vec3(0.0);
        for (int j = 0; j < 3; j++) {
          for (int i = 0; i < 5; i++) {
            color[j] += lineWidth * float(i * i) / abs(
              fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0
              - length(uv)
              + mod(uv.x + uv.y, 0.2)
            );
          }
        }

        vec3 tuned = vec3(color.r * ${presetColor[0]}, color.g * ${presetColor[1]}, color.b * ${presetColor[2]});
        gl_FragColor = vec4(tuned, 1.0);
      }
    `;

    const camera = new THREE.Camera();
    camera.position.z = 1;

    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);
    const uniforms = {
      time: { value: 1 },
      resolution: { value: new THREE.Vector2() },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      depthWrite: false,
      depthTest: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      uniforms.resolution.value.set(
        renderer.domElement.width,
        renderer.domElement.height,
      );
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const animate = () => {
      uniforms.time.value += getSpeedStep(speed);
      renderer.render(scene, camera);
      sceneRef.current!.animationId = requestAnimationFrame(animate);
    };

    sceneRef.current = {
      renderer,
      geometry,
      material,
      animationId: requestAnimationFrame(animate),
    };

    return () => {
      resizeObserver.disconnect();

      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
        if (sceneRef.current.renderer.domElement.parentElement === container) {
          container.removeChild(sceneRef.current.renderer.domElement);
        }
        sceneRef.current.renderer.dispose();
        sceneRef.current.geometry.dispose();
        sceneRef.current.material.dispose();
        sceneRef.current = null;
      }
    };
  }, [disabled, preset, speed]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden bg-background",
        disabled &&
          "bg-[radial-gradient(circle_at_50%_30%,hsl(var(--primary)/0.18),transparent_36%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]",
        className,
      )}
    />
  );
}

function getPresetColor(
  preset: NonNullable<ShaderAnimationProps["preset"]>,
): [number, number, number] {
  const colors: Record<NonNullable<ShaderAnimationProps["preset"]>, [number, number, number]> = {
    "ultrax-wave": [0.55, 0.85, 1.2],
    "blue-nebula": [0.38, 0.78, 1.45],
    "purple-flow": [0.86, 0.48, 1.35],
    "aurora-lines": [0.42, 1.25, 0.95],
    "calm-grid": [0.62, 0.92, 1.02],
  };
  return colors[preset];
}

function getSpeedStep(speed: NonNullable<ShaderAnimationProps["speed"]>): number {
  const steps: Record<NonNullable<ShaderAnimationProps["speed"]>, number> = {
    slow: 0.026,
    normal: 0.045,
    fast: 0.072,
  };
  return steps[speed];
}

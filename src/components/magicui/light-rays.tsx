import { useEffect, useRef } from "react";

type LightRaysProps = {
  className?: string;
  /** Ray tint (any CSS color). Defaults to the current text color via `currentColor`. */
  color?: string;
  /** Number of rays. */
  count?: number;
  /** Peak opacity of a ray at its brightest. 0..1 */
  intensity?: number;
  /** Animation speed multiplier. */
  speed?: number;
  /** Ray origin, in fractional coords of the canvas (0..1). Default top-center. */
  origin?: { x: number; y: number };
  /** Blur radius in px applied to the whole ray layer. */
  blur?: number;
};

/**
 * LightRays — a lightweight canvas ambient background that renders soft,
 * slowly drifting rays fanning out from an origin. Fills its parent.
 * Requires the parent to be `position: relative` (or similar).
 */
export function LightRays({
  className = "",
  color = "currentColor",
  count = 14,
  intensity = 0.18,
  speed = 1,
  origin = { x: 0.5, y: -0.05 },
  blur = 24,
}: LightRaysProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resolve `currentColor` against the canvas element.
    const resolveColor = () => {
      if (color !== "currentColor") return color;
      const c = getComputedStyle(canvas).color;
      return c || "rgb(255,255,255)";
    };

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Seed rays with stable random-ish properties.
    const rays = Array.from({ length: count }).map((_, i) => {
      const t = i / count;
      return {
        // Base angle in radians (downward fan across ~140°).
        base: (-70 + t * 140 + (Math.random() * 10 - 5)) * (Math.PI / 180),
        // Sway amplitude and phase for gentle drift.
        sway: 0.04 + Math.random() * 0.06,
        phase: Math.random() * Math.PI * 2,
        // Ray width (in radians) and length factor.
        width: 0.05 + Math.random() * 0.08,
        length: 0.9 + Math.random() * 0.4,
        // Per-ray brightness variance.
        alpha: 0.55 + Math.random() * 0.45,
      };
    });

    let start = performance.now();
    const draw = (now: number) => {
      const t = ((now - start) / 1000) * speed;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      const ox = origin.x * width;
      const oy = origin.y * height;
      const maxLen = Math.hypot(width, height) * 1.2;
      const strokeColor = resolveColor();

      for (const r of rays) {
        const angle = r.base + Math.sin(t * 0.6 + r.phase) * r.sway;
        const len = maxLen * r.length;
        const ex = ox + Math.sin(angle) * len;
        const ey = oy + Math.cos(angle) * len;

        // Build a soft triangular ray via a linear gradient.
        const grad = ctx.createLinearGradient(ox, oy, ex, ey);
        const a = intensity * r.alpha * (0.85 + 0.15 * Math.sin(t + r.phase));
        grad.addColorStop(0, withAlpha(strokeColor, a));
        grad.addColorStop(0.6, withAlpha(strokeColor, a * 0.35));
        grad.addColorStop(1, withAlpha(strokeColor, 0));

        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(width, height) * r.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [color, count, intensity, speed, origin.x, origin.y]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ filter: `blur(${blur}px)` }}
    />
  );
}

/** Convert any CSS color (rgb/rgba/hex/named) to rgba() with a given alpha. */
function withAlpha(color: string, alpha: number) {
  const a = Math.max(0, Math.min(1, alpha));
  if (color.startsWith("rgba")) {
    return color.replace(/rgba\(([^)]+)\)/, (_, inside) => {
      const parts = inside.split(",").map((s: string) => s.trim());
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${a})`;
    });
  }
  if (color.startsWith("rgb")) {
    return color.replace(/rgb\(([^)]+)\)/, (_, inside) => `rgba(${inside}, ${a})`);
  }
  // Fallback: rely on the browser to parse via a temp element.
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.style.color = color;
    document.body.appendChild(el);
    const parsed = getComputedStyle(el).color;
    document.body.removeChild(el);
    const m = parsed.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const [r, g, b] = m[1].split(",").map((s) => s.trim());
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }
  return color;
}

"use client";

import { cn } from "@/lib/utils";
import { useId } from "react";

interface ShineBorderProps {
  borderWidth?: number;
  duration?: number;
  shineColor?: string | string[];
  className?: string;
  style?: React.CSSProperties;
}

/**
 * ShineBorder — an animated conic-gradient border that rotates around its parent.
 * The parent MUST be `position: relative` and set its own border-radius.
 */
export function ShineBorder({
  borderWidth = 1,
  duration = 4,
  shineColor = "#E8DFC8",
  className,
  style,
}: ShineBorderProps) {
  const id = useId().replace(/:/g, "");
  const colors = Array.isArray(shineColor) ? shineColor : [shineColor, "#ffffff", shineColor];
  return (
    <div
      style={{
        "--border-width": `${borderWidth}px`,
        "--duration": `${duration}s`,
        ...style,
      } as React.CSSProperties}
      className={cn(
        "pointer-events-none absolute inset-0 size-full overflow-hidden rounded-[inherit]",
        className,
      )}
    >
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`shine-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors[0]} stopOpacity="0" />
            <stop offset="42%" stopColor={colors[0]} stopOpacity="0.35" />
            <stop offset="52%" stopColor={colors[1] ?? colors[0]} stopOpacity="1" />
            <stop offset="62%" stopColor={colors[2] ?? colors[0]} stopOpacity="0.45" />
            <stop offset="100%" stopColor={colors[0]} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect
          className="animate-shine-dash"
          x="1"
          y="1"
          width="98"
          height="98"
          rx="4"
          ry="4"
          fill="none"
          pathLength="100"
          stroke={`url(#shine-${id})`}
          strokeWidth="var(--border-width)"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

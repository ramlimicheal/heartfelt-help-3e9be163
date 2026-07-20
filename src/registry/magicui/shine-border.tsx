"use client";

import { cn } from "@/lib/utils";

interface ShineBorderProps {
  borderWidth?: number;
  duration?: number;
  shineColor?: string | string[];
  className?: string;
  style?: React.CSSProperties;
}

/**
 * ShineBorder — an animated conic-gradient border that shines around its parent.
 * The parent MUST be `position: relative` and set its own border-radius.
 */
export function ShineBorder({
  borderWidth = 1,
  duration = 14,
  shineColor = "#E8DFC8",
  className,
  style,
}: ShineBorderProps) {
  return (
    <div
      style={{
        "--border-width": `${borderWidth}px`,
        "--duration": `${duration}s`,
        backgroundImage: `radial-gradient(transparent, transparent, ${
          Array.isArray(shineColor) ? shineColor.join(",") : shineColor
        }, transparent, transparent)`,
        backgroundSize: "300% 300%",
        mask: `linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)`,
        WebkitMask: `linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)`,
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
        padding: "var(--border-width)",
        ...style,
      } as React.CSSProperties}
      className={cn(
        "pointer-events-none absolute inset-0 size-full rounded-[inherit] will-change-[background-position] motion-safe:animate-shine",
        className,
      )}
    />
  );
}

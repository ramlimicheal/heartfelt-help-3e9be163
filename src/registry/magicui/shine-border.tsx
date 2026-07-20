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
 * ShineBorder — an animated conic-gradient border that rotates around its parent.
 * The parent MUST be `position: relative` and set its own border-radius.
 */
export function ShineBorder({
  borderWidth = 1,
  duration = 6,
  shineColor = "#E8DFC8",
  className,
  style,
}: ShineBorderProps) {
  const colors = Array.isArray(shineColor) ? shineColor.join(", ") : shineColor;
  return (
    <div
      style={{
        "--border-width": `${borderWidth}px`,
        "--duration": `${duration}s`,
        backgroundImage: `conic-gradient(from var(--shine-angle, 0deg), transparent 0%, transparent 60%, ${colors} 75%, transparent 90%, transparent 100%)`,
        mask: `linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)`,
        WebkitMask: `linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)`,
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
        padding: "var(--border-width)",
        ...style,
      } as React.CSSProperties}
      className={cn(
        "pointer-events-none absolute inset-0 size-full rounded-[inherit] motion-safe:animate-shine-spin",
        className,
      )}
    />
  );
}

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
  duration = 4,
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
        mask: `linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)`,
        WebkitMask: `linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)`,
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
        padding: "var(--border-width)",
        ...style,
      } as React.CSSProperties}
      className={cn(
        "pointer-events-none absolute inset-0 size-full overflow-hidden rounded-[inherit]",
        className,
      )}
    >
      <div
        className="animate-shine-orbit absolute left-1/2 top-1/2 aspect-square w-[180%] -translate-x-1/2 -translate-y-1/2"
        style={{
          backgroundImage: `conic-gradient(from 0deg, transparent 0%, transparent 58%, ${colors} 69%, rgba(255,255,255,0.95) 72%, ${colors} 76%, transparent 88%, transparent 100%)`,
        }}
      />
    </div>
  );
}

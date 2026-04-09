"use client";

import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

export interface SiriOrbColors {
  bg?: string;
  c1?: string;
  c2?: string;
  c3?: string;
}

export interface SiriOrbProps {
  /** CSS length, e.g. `"112px"` */
  size?: string;
  className?: string;
  colors?: SiriOrbColors;
  animationDuration?: number;
}

/** Hex defaults aligned with `--v2-primary` / cyan accents (visible on white canvas). */
const defaultColors = {
  bg: "transparent",
  c1: "#0386fd",
  c2: "#63b5ff",
  c3: "#0278e0",
} satisfies Required<SiriOrbColors>;

/**
 * Animated “Siri-style” gradient orb. Layers are real DOM nodes (not ::before)
 * so paints reliably in Chromium + with Tailwind’s CSS pipeline.
 */
export function SiriOrb({
  size = "112px",
  className,
  colors,
  animationDuration = 20,
}: SiriOrbProps) {
  const finalColors = { ...defaultColors, ...colors };
  const sizeValue =
    Number.parseInt(String(size).replace(/px$/i, ""), 10) || 112;
  const blurAmount = Math.max(sizeValue * 0.04, 5);
  const contrastAmount = Math.max(sizeValue * 0.0025, 1.35);

  const style = {
    width: size,
    height: size,
    "--bg": finalColors.bg,
    "--c1": finalColors.c1,
    "--c2": finalColors.c2,
    "--c3": finalColors.c3,
    "--animation-duration": `${animationDuration}s`,
    "--blur-amount": `${blurAmount}px`,
    "--contrast-amount": contrastAmount,
  } as CSSProperties;

  return (
    <div className={cn("siri-orb", className)} style={style} aria-hidden>
      <div className="siri-orb__blob" />
      <div className="siri-orb__shine" />
    </div>
  );
}

export default SiriOrb;

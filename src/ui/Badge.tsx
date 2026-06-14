// Pill badge per DESIGN.md (surface-strong, caption-strong, rounded.pill).

import type { ReactNode } from "react";
import { cn } from "./cn";

interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "up" | "down" | "brand";
  className?: string;
}

const tones = {
  neutral: "bg-surface-strong text-ink",
  brand: "bg-primary/10 text-primary",
  up: "bg-surface-strong text-semantic-up",
  down: "bg-surface-strong text-semantic-down",
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[100px] px-[10px] py-[3px] text-[12px] font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

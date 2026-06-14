// Pill buttons per DESIGN.md (rounded.pill, 44px height, weight 600).

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-[8px] rounded-[100px] font-semibold " +
  "transition-colors disabled:cursor-not-allowed select-none";

const sizes: Record<Size, string> = {
  md: "h-[44px] px-[20px] text-[16px]",
  lg: "h-[56px] px-[32px] text-[16px]",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-active active:bg-primary-active disabled:bg-primary-disabled",
  secondary:
    "bg-surface-strong text-ink hover:bg-hairline active:bg-hairline disabled:opacity-50",
  outline:
    "bg-transparent text-ink border border-hairline hover:bg-surface-soft disabled:opacity-50",
  ghost: "bg-transparent text-primary hover:bg-surface-soft disabled:opacity-50",
  danger:
    "bg-semantic-down text-on-primary hover:opacity-90 active:opacity-80 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(base, sizes[size], variants[variant], block && "w-full", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

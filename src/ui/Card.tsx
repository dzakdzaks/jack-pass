// Feature card per DESIGN.md (rounded.xl, 32px padding, hairline border, soft shadow on hover).

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  pad?: boolean;
}

export function Card({ children, pad = true, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-hairline bg-canvas",
        pad && "p-[32px]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

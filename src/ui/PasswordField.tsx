// Password input with a reveal/hide toggle (reset on unmount by React).

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

type Props = InputHTMLAttributes<HTMLInputElement>;

export const PasswordField = forwardRef<HTMLInputElement, Props>(function PasswordField(
  { className, ...rest },
  ref,
) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={show ? "text" : "password"}
        className={cn(
          "h-[48px] w-full rounded-[12px] border border-hairline bg-canvas pl-[16px] pr-[64px] text-[16px] text-ink",
          "placeholder:text-muted-soft focus:border-2 focus:border-primary focus:outline-none",
          className,
        )}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute right-[8px] top-1/2 -translate-y-1/2 rounded-[100px] px-[12px] py-[6px] text-[13px] font-semibold text-primary hover:bg-surface-soft"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
});

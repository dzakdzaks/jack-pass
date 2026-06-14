// Text input / textarea per DESIGN.md (rounded.md, 48px height, focus -> 2px primary border).

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

const fieldBase =
  "w-full rounded-[12px] border border-hairline bg-canvas px-[16px] text-[16px] text-ink " +
  "placeholder:text-muted-soft focus:border-primary focus:outline-none focus:ring-0 " +
  "focus:border-2 disabled:opacity-60";

interface FieldWrapProps {
  label?: string;
  error?: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}

export function Field({ label, error, hint, htmlFor, children }: FieldWrapProps) {
  return (
    <div className="flex flex-col gap-[6px]">
      {label && (
        <label htmlFor={htmlFor} className="text-[14px] font-semibold text-body-strong">
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[13px] text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-[13px] text-semantic-down">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(fieldBase, "h-[48px]", className)} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-[96px] py-[12px]", className)} {...rest} />;
});

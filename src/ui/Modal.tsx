// Accessible modal/sheet. Centered card on desktop, bottom sheet on mobile.

import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-[16px]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-full max-w-[480px] rounded-t-[24px] bg-canvas p-[24px] outline-none sm:rounded-[24px] sm:p-[32px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-[16px] text-[20px] font-semibold text-ink">{title}</h2>
        <div className="flex flex-col gap-[16px]">{children}</div>
        {footer && <div className="mt-[24px] flex justify-end gap-[12px]">{footer}</div>}
      </div>
    </div>
  );
}

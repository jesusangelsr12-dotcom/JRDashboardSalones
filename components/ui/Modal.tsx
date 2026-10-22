"use client";

import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

// Hoja inferior: sube desde abajo al abrir y se cierra tocando el fondo.
export default function Modal({ open, onClose, children }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-tinta/40 animate-[fadeIn_.2s_ease-out]" onClick={onClose} />
      {/* Content */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-app bg-surface rounded-t-[28px] px-5 pt-3 shadow-xl max-h-[88dvh] overflow-y-auto animate-[sheetUp_.32s_cubic-bezier(.2,.8,.2,1)]"
        style={{ paddingBottom: "calc(2.25rem + var(--safe-area-bottom))" }}
      >
        <div className="w-10 h-[5px] bg-tinta/15 rounded-full mx-auto mb-4" />
        {children}
      </div>
    </div>
  );
}

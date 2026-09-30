"use client";

import { useState } from "react";

// Fuerza la última versión publicada: borra las cachés del service worker,
// lo des-registra (se vuelve a registrar limpio al cargar) y recarga.
export async function forceUpdate(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // Si la limpieza falla, igual recargamos
  }
  window.location.reload();
}

export default function UpdateButton() {
  const [updating, setUpdating] = useState(false);

  const handleClick = () => {
    if (updating) return;
    setUpdating(true);
    forceUpdate();
  };

  return (
    <div className="flex justify-center">
      <button
        onClick={handleClick}
        disabled={updating}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-surface text-[12px] font-display font-medium text-text-secondary transition-all active:scale-95 disabled:opacity-60"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={updating ? "animate-spin" : ""}
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <polyline points="21 3 21 9 15 9" />
        </svg>
        <span>{updating ? "Actualizando…" : "Actualizar"}</span>
      </button>
    </div>
  );
}

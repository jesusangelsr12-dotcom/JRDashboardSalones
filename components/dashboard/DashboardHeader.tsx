"use client";

import Link from "next/link";
import type { Salon } from "@/lib/types";
import { rangoSemanaActual } from "@/lib/calculations";

interface DashboardHeaderProps {
  salon: Salon;
}

export default function DashboardHeader({ salon }: DashboardHeaderProps) {
  const semana = rangoSemanaActual();

  return (
    <header className="relative pt-4 pb-6">
      {/* Gradient bleed from salon color */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          background: `radial-gradient(ellipse at top left, ${salon.color} 0%, transparent 60%)`,
        }}
      />

      {/* Nav row */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center active:scale-95 transition-transform"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 3L5 8L10 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        <Link
          href={`/salon/${salon.id}/config`}
          className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center active:scale-95 transition-transform"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="3" r="1.2" fill="currentColor" />
            <circle cx="8" cy="8" r="1.2" fill="currentColor" />
            <circle cx="8" cy="13" r="1.2" fill="currentColor" />
          </svg>
        </Link>
      </div>

      {/* Salon identity */}
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-3 h-3 rounded-full border-[2.5px] border-bg outline outline-2"
          style={{ backgroundColor: salon.color, outlineColor: salon.color }}
        />
        <h1 className="text-xl font-bold font-display text-text-primary tracking-tight">
          {salon.nombre}
        </h1>
      </div>

      {/* Week range */}
      <p className="text-[13px] text-text-secondary font-mono ml-6">
        {semana.label}
      </p>
    </header>
  );
}

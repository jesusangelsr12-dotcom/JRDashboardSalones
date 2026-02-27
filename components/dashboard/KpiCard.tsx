"use client";

import { formatMoney } from "@/lib/calculations";

interface KpiCardProps {
  label: string;
  value: number;
  accentColor?: string;
  variant?: "large" | "default";
  negative?: boolean;
}

export default function KpiCard({
  label,
  value,
  accentColor,
  variant = "default",
  negative = false,
}: KpiCardProps) {
  const isLarge = variant === "large";

  return (
    <div
      className={`relative overflow-hidden rounded-card border border-border p-4 ${
        isLarge ? "bg-surface col-span-2" : "bg-surface"
      }`}
    >
      {/* Accent stripe */}
      {accentColor && (
        <div
          className="absolute top-0 left-0 w-full h-[3px]"
          style={{ backgroundColor: accentColor }}
        />
      )}

      <p className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-2">
        {label}
      </p>

      <p
        className={`font-numbers font-medium leading-none ${
          isLarge ? "text-[32px]" : "text-xl"
        } ${negative ? "text-red-500" : "text-text-primary"}`}
      >
        {negative && value > 0 ? "-" : ""}
        {formatMoney(Math.abs(value))}
      </p>
    </div>
  );
}

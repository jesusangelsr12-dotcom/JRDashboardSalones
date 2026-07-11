"use client";

import { formatMoney } from "@/lib/calculations";

interface KpiCardProps {
  label: string;
  value: number;
  accentColor?: string;
  variant?: "large" | "default";
  negative?: boolean;
  onClick?: () => void;
}

export default function KpiCard({
  label,
  value,
  accentColor,
  variant = "default",
  negative = false,
  onClick,
}: KpiCardProps) {
  const isLarge = variant === "large";
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={`relative overflow-hidden rounded-card border border-border p-4 ${
        isLarge ? "bg-surface col-span-2" : "bg-surface"
      } ${onClick ? "text-left w-full transition-all active:scale-[0.98]" : ""}`}
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

      {onClick && (
        <p className="text-[10px] font-mono text-text-secondary mt-1.5">
          Ver detalle
        </p>
      )}
    </Wrapper>
  );
}

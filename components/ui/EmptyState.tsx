"use client";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: string;
}

export default function EmptyState({
  title,
  description,
  icon = "📋",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold font-display text-text-primary mb-1">
        {title}
      </h3>
      <p className="text-sm text-text-secondary max-w-[260px]">
        {description}
      </p>
    </div>
  );
}

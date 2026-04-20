import React from 'react';

export default function StatusDotLabel({
  label,
  dotClassName,
  textClassName = 'text-zinc-700 dark:text-zinc-300',
  ariaLabel,
  title
}) {
  const resolvedTitle = title || ariaLabel || label;

  return (
    <span
      className="inline-flex items-center gap-2"
      aria-label={ariaLabel || label}
      title={resolvedTitle}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClassName}`} aria-hidden="true" />
      <span className={`font-medium text-xs ${textClassName}`}>{label}</span>
    </span>
  );
}

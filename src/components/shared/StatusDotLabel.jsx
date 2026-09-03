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
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotClassName}`} aria-hidden="true" />
      <span className={`font-medium text-xs ${textClassName}`}>{label}</span>
    </span>
  );
}

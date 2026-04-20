import React from 'react';

export default function EmptyState({
  title,
  description,
  icon,
  className = ''
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-2 ${className}`}>
      {icon ? (
        <div className="mb-3 text-zinc-300 dark:text-zinc-600" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">{title}</p>
      {description ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{description}</p>
      ) : null}
    </div>
  );
}

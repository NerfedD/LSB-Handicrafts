import React from 'react';

export default function ListHeaderBar({ description, children }) {
  return (
    <div className="p-4 md:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 dark:border-[#1F1F2E]">
      <p className="text-zinc-500 dark:text-zinc-400 text-sm">{description}</p>
      {children}
    </div>
  );
}

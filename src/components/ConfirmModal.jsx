import React from 'react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-[#1F1F2E] rounded-2xl p-6 max-w-sm w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{title}</h3>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">{message}</p>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-3 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#1A1A24] transition-colors w-full sm:w-auto text-center">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-3 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors w-full sm:w-auto text-center">Confirm</button>
        </div>
      </div>
    </div>
  );
}
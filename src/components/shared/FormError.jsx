import { useEffect, useRef } from 'react';

export default function FormError({ message }) {
  const boundary = useRef(null);
  useEffect(() => {
    if (!message || !boundary.current) return;
    const form = boundary.current.closest('form');
    const target = form?.querySelector('[aria-invalid="true"]') ?? boundary.current;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.focus({ preventScroll: true });
  }, [message]);
  if (!message) return null;
  return <p ref={boundary} role="alert" tabIndex={-1} data-form-error className="rounded-field border border-red bg-tint-red p-4 text-[16px] font-bold text-red-text">{message}</p>;
}

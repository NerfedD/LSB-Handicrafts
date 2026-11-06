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
  return <p ref={boundary} role="alert" tabIndex={-1} data-form-error className="mb-3.5 rounded-md border border-danger-bd bg-danger-bg p-3 text-13 font-medium text-danger-fg">{message}</p>;
}

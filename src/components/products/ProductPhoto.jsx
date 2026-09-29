import { useId, useRef, useState } from 'react';

import { ImagePlus, Trash2 } from '../icons';
import { Button } from '@/components/ui/button';
import { PhotoSlot } from '../shared/forms';
import { preparePhoto } from '../../utils/photos';

/** A product's photo, or the empty slot when it has none. */
export function ProductPhoto({ src, name, isLoaded = true, className }) {
  if (!isLoaded) return <PhotoSlot label="Loading the photo…" className={className} />;
  if (!src) return <PhotoSlot label="No photo yet" hint={null} className={className} />;
  return (
    <img
      src={src}
      alt={name ? `Photo of ${name}` : 'Product photo'}
      className={`aspect-square w-full rounded-tile2 border border-card bg-paper-2 object-cover ${className ?? ''}`}
    />
  );
}

/**
 * Choosing, previewing, replacing and removing a product's photo on the form.
 *
 * Nothing is uploaded here. The chosen photo is resized in the browser and
 * shown at once, and it is saved with the rest of the product when the form is
 * saved -- so Cancel really does leave the old photo in place.
 *
 * `value` is { change: null | 'set' | 'remove', dataUrl }, and `current` is the
 * photo already saved, if any.
 */
export function ProductPhotoField({ value, current, onChange, disabled = false, name }) {
  const input = useRef(null);
  const id = useId();
  const [error, setError] = useState(null);
  const [working, setWorking] = useState(false);
  const shown = value.change === 'set' ? value.dataUrl : value.change === 'remove' ? null : current;

  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setWorking(true);
    try {
      onChange({ change: 'set', dataUrl: await preparePhoto(file) });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[16px] font-bold text-ink" id={`${id}-label`}>Product photo</p>
      <ProductPhoto src={shown} name={name} />
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        disabled={disabled || working}
        onChange={choose}
      />
      <div className="flex flex-wrap gap-2.5">
        <Button variant="outline" disabled={disabled || working} onClick={() => input.current?.click()}>
          <ImagePlus className="h-4.5 w-4.5" />
          {working ? 'Preparing…' : shown ? 'Replace photo' : 'Add a photo'}
        </Button>
        {shown && (
          <Button variant="outline" disabled={disabled || working} onClick={() => onChange({ change: current ? 'remove' : null, dataUrl: null })}>
            <Trash2 className="h-4.5 w-4.5" />
            Remove photo
          </Button>
        )}
        {value.change && current && (
          <Button variant="ghost" disabled={disabled || working} onClick={() => { setError(null); onChange({ change: null, dataUrl: null }); }}>
            Keep the saved photo
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-[14.5px] font-bold text-red-text">{error}</p>
      ) : (
        <p id={`${id}-hint`} className="text-[14.5px] text-muted">
          {value.change === 'set' ? 'New photo chosen. It is saved when you save the product.'
            : value.change === 'remove' ? 'The photo will be removed when you save the product.'
              : 'JPEG, PNG or WebP. It is resized to 800 × 800 at most before it is saved.'}
        </p>
      )}
    </div>
  );
}

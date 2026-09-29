/**
 * Turning a chosen file into a photo the database will accept.
 *
 * The browser does the work: the picture is scaled so its longer side is at
 * most 800px and saved as a JPEG, which keeps a phone camera's 5 MB photo to
 * about 100 KB. The database stores it as a data URL and refuses anything over
 * about 1 MB, so this steps the quality down until it fits.
 */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX_SIDE = 800;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_DATA_URL = 1_400_000;

export function photoFileProblem(file) {
  if (!file) return 'Choose a photo.';
  if (!PHOTO_TYPES.includes(file.type)) return 'Choose a JPEG, PNG or WebP photo.';
  if (file.size > MAX_FILE_BYTES) return 'That file is larger than 15 MB. Choose a smaller photo.';
  return null;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as a photo.')); };
    image.src = url;
  });
}

/** Resolves to a JPEG data URL no larger than the database allows. */
export async function preparePhoto(file) {
  const problem = photoFileProblem(file);
  if (problem) throw new Error(problem);
  const image = await loadImage(file);
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  // A transparent PNG would otherwise turn black as a JPEG.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.86, 0.75, 0.6, 0.45]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_DATA_URL) return dataUrl;
  }
  throw new Error('That photo is too detailed to store. Try a simpler or smaller one.');
}

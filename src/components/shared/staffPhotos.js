import { createContext, useContext } from "react";

/**
 * Staff photos by lower-cased name, provided once by App (public.staff_photos).
 * An avatar of a staff member shows their photo where they have set one.
 */
export const StaffPhotos = createContext(new Map());

/** The photo for a staff member's name, or null. */
export function useStaffPhoto(name) {
  const photos = useContext(StaffPhotos);
  return photos.get(String(name ?? "").trim().toLowerCase()) ?? null;
}

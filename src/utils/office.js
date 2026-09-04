/**
 * How to reach a human.
 *
 * The sign-in screen and the two "you cannot fix this yourself" states offer a
 * phone number, because an internal system with no public sign-up has no other
 * way for a locked-out person to get help — and the alternative to a number on
 * screen is them giving up.
 *
 * PLACEHOLDER UNTIL CONFIRMED. `(082) 000 0000` is what the design mockups
 * carry and it is not a real line. Set VITE_OFFICE_PHONE in .env to the actual
 * office number before this goes in front of staff; it is listed in the
 * handoff's open questions for that reason.
 */
export const OFFICE_PHONE =
  import.meta.env.VITE_OFFICE_PHONE || "(082) 000 0000";

/** True when the number above is still the mockup placeholder. */
export const OFFICE_PHONE_IS_PLACEHOLDER = !import.meta.env.VITE_OFFICE_PHONE;

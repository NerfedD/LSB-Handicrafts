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
const PLACEHOLDER = "(082) 000 0000";

export const OFFICE_PHONE = import.meta.env.VITE_OFFICE_PHONE || PLACEHOLDER;

/**
 * True when the number above is still the mockup placeholder.
 *
 * COMPARED BY VALUE, NOT BY PRESENCE. This was `!import.meta.env.VITE_OFFICE_PHONE`,
 * which asks "was the variable set?" rather than "is it a real number?" -- and
 * the variable is set to the placeholder in .env.example, so every checkout
 * that copies that file (the documented way to start) got a `false` here and
 * printed `(082) 000 0000` on the customer's order slip as though it were the
 * office line. A wrong number on a sheet handed to a customer is worse than no
 * number: they ring it, nobody answers, and the business looks shut.
 *
 * Compared on digits so the formatting in .env does not matter -- "(082) 000
 * 0000", "082 000 0000" and "0820000000" are all still the placeholder.
 */
const digitsOf = (value) => String(value ?? "").replace(/\D/g, "");

export const OFFICE_PHONE_IS_PLACEHOLDER =
  digitsOf(OFFICE_PHONE) === digitsOf(PLACEHOLDER);

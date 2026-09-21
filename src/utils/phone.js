/**
 * Contact numbers.
 *
 * ONE SHAPE, AND ONLY ONE: eleven digits beginning 09, the Philippine mobile
 * number. `09171234503` and nothing else.
 *
 * This file used to hold three verdicts — impossible, unexpected, fine — so
 * that a supplier in Cebu with an unanticipated numbering plan could still be
 * recorded after being asked about. That was the right shape for a rule that
 * accepted landlines, international format and every way people punctuate a
 * number. It is the wrong shape for this one: when exactly one form is valid,
 * there is nothing left that is merely surprising, and a question with only one
 * possible answer is a worse error message than an error message.
 *
 * So `phoneDoubt` is gone, and with it the "Save it anyway?" prompt. What
 * remains is `phoneProblem`, which refuses in a sentence naming the count, and
 * `cleanPhoneInput`, which makes most of those refusals impossible to reach by
 * keeping anything else out of the box in the first place.
 *
 * WHAT THIS COSTS, stated plainly because it is a real loss. Landlines can no
 * longer be stored: `(02) 8888 8888` is ten digits and is now refused, as is
 * `082 555 0301`. No landline is currently recorded anywhere in this database,
 * so nothing in the books breaks today, but a shop that starts buying from a
 * supplier who answers a landline has nowhere to put the number.
 *
 * WHAT IT BUYS. Every number in the system dials, is the same length, sorts and
 * compares as itself, and can be handed to anything expecting a bare mobile
 * number without being parsed first. A field that admits one shape can also
 * enforce that shape as it is typed, which is the only kind of validation that
 * never surprises anybody at the end of a form.
 *
 * +63 IS NOT A SECOND SHAPE, it is this one written for abroad, so it is
 * converted rather than refused: `+63 917 123 4503` becomes `09171234503` as it
 * is typed. Nobody is told off for pasting a number out of a contact card.
 */

/** Just the digits, exactly as written — no interpretation. */
export const phoneDigits = (value) => String(value ?? "").replace(/\D/g, "");

/**
 * The digits as this shop stores them: `+63 9…` and `63 9…` rewritten to `09…`.
 *
 * Applied to a HALF-TYPED value too, which is what makes it work in an onChange
 * rather than only on submit. `6391` becomes `091` the moment the 9 lands, so
 * the box walks toward the right shape while somebody types instead of
 * rejecting the whole thing once they stop. The `[2] === "9"` guard is what
 * keeps it honest: only a mobile is rewritten, so this can never invent a
 * leading 0 for some other number that happens to start 63.
 */
export const localPhoneDigits = (value) => {
  const digits = phoneDigits(value);
  return digits.startsWith("63") && digits[2] === "9" ? `0${digits.slice(2)}` : digits;
};

/** How many digits a Philippine mobile number has. */
export const PHONE_DIGITS = 11;

/**
 * The field's own shape rule: digits, and nothing else.
 *
 * It deliberately still does NOT encode the count, even though it now easily
 * could. A `pattern` can only ever produce the browser's "Please match the
 * requested format", which names neither the problem nor the fix; the count is
 * `phoneProblem`'s to report, because it can say "that has 10" and point
 * somebody at the digit they dropped.
 */
export const PHONE_SHAPE_PATTERN = "[0-9]*";

/**
 * The character cap, matching `char_length(value) <= 32` in the database.
 *
 * IT IS NOT 11, AND THAT IS NOT AN OVERSIGHT. The box only ever settles on
 * digits, so eleven looks like the honest number — but `maxlength` is enforced
 * by the browser on the way IN, before any of this code sees the value, and a
 * paste arrives with its punctuation still attached. `0917 555 0201` is
 * thirteen characters; under a cap of eleven the browser hands over
 * `0917 555 02`, and `cleanPhoneInput` then faithfully cleans a number that has
 * already had two digits cut off it. The person pasted a correct number and the
 * box silently holds a wrong one.
 *
 * So the cap stays wide enough for the punctuation somebody might paste, and
 * the ELEVEN is enforced by cleanPhoneInput, which counts digits and runs after
 * the punctuation is gone. Typing is unaffected either way: each keystroke is
 * cleaned as it lands, so the box never accumulates characters to cap.
 */
export const PHONE_MAX_CHARS = 32;

/** What the field says about itself, in this app's words rather than Chrome's. */
export const PHONE_TITLE = "Eleven digits beginning 09 — for example 09171234503.";

/**
 * What a phone field accepts as it is typed.
 *
 * NOTHING BUT DIGITS LANDS IN THE BOX, and never a twelfth one. A rule enforced
 * three screens later by an error message is a rule people learn by being told
 * off; applied here it costs nothing and is never seen. Punctuation is not
 * refused so much as absorbed — typing or pasting `0917 555 0201` leaves
 * `09175550201` behind, which is the same number, so the person who wrote it
 * the way they always write it is neither corrected nor stopped.
 */
export const cleanPhoneInput = (value) =>
  localPhoneDigits(value).slice(0, PHONE_DIGITS);

/** Everything a person legitimately types around the digits, on a paste. */
const SHAPE = /^[\d\s()+.-]*$/;

/**
 * A reason this cannot be saved, or null.
 *
 * An empty value is NOT a problem here: whether the field is required is the
 * form's question, not this module's, and the two forms disagree (a customer
 * must have a number, a staff account need not).
 *
 * Still checks for letters even though `cleanPhoneInput` keeps them out of the
 * box, because this function is also the rule applied to a value that arrived
 * some other way — seeded, pasted into a field that forgot to clean, or already
 * sitting in the database from before any of this existed.
 */
export function phoneProblem(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (!SHAPE.test(raw)) {
    return "A phone number is digits only — check for stray letters.";
  }

  const digits = localPhoneDigits(raw);

  if (digits.length !== PHONE_DIGITS) {
    return `A phone number is ${PHONE_DIGITS} digits beginning 09 — that has ${digits.length}.`;
  }
  // Eleven digits, but not this shop's eleven: a landline written without its
  // trunk 0, or a number from a plan this app no longer stores.
  if (!digits.startsWith("09")) {
    return "A phone number begins 09 — check the first two digits.";
  }
  return null;
}

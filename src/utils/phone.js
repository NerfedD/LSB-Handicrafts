/**
 * Contact numbers.
 *
 * WHY THIS IS TWO FUNCTIONS AND NOT ONE REGEX. A phone number field has three
 * possible verdicts, not two, and collapsing them into "valid / invalid" gets
 * one of them wrong every time:
 *
 *   1. IMPOSSIBLE — letters in it, four digits, forty digits. Nobody can ring
 *      this, it is a typo, and saving it helps no one. A hard error.
 *   2. UNEXPECTED — twelve digits starting 09, or eleven digits starting 3.
 *      Probably a typo. But this shop could genuinely be buying foam from a
 *      supplier in Cebu with a numbering plan nobody here anticipated, and a
 *      hard error on that is an app refusing to record a real phone number
 *      because it has opinions. A warning, and the person decides.
 *   3. FINE — a Philippine mobile or landline in any of the shapes people
 *      actually write them in.
 *
 * The middle case is the whole reason this file exists. Every number already in
 * this database was typed with no checking at all, which is how it ended up
 * holding '34234234324' and a fourteen-digit mobile; but the answer to that is
 * to ASK, not to start rejecting numbers the shop knows are right.
 *
 * WHAT COUNTS AS FINE, deliberately generous about punctuation because people
 * write the same number five ways and all of them dial:
 *
 *   09171234503        mobile, national
 *   0917 555 0201      the same, spaced
 *   +63 917 123 4503   the same, international
 *   082 555 0301       a Davao landline
 *   (02) 8888 8888     a Manila landline
 *
 * The 7-and-15-digit bounds are E.164's: 15 digits is the longest number the
 * international standard allows to exist, and under 7 there is no national
 * number anywhere that could be dialled.
 */

/** Just the digits — what actually gets dialled. */
export const phoneDigits = (value) => String(value ?? "").replace(/\D/g, "");

/**
 * The same rule, in the two forms an `<input>` needs it.
 *
 * These exist so the phone field cannot quietly enforce a DIFFERENT rule from
 * the one below, which is exactly what it was doing: it carried
 * `pattern="[0-9]{7,15}"`, which is digits-only and counts CHARACTERS rather
 * than digits. Every layer around it — this module, and the
 * `contact_number_ok` constraint in schema.sql — allows punctuation and counts
 * digits, so the field was the strictest thing in the stack and the only one
 * that was wrong. The visible cost was that `0917 555 0204`, a number already
 * in the customers table and accepted by everything else, could not be saved
 * back: `guardForm` found the element invalid and refused the submit with the
 * browser's own "Please match the requested format".
 *
 * WHAT THE ATTRIBUTE IS FOR, now. Shape only — the characters a phone number
 * may be written with. It deliberately does NOT encode the digit count, even
 * though it easily could, because a count is a verdict and this file has three
 * of those, not two. `phoneProblem` refuses what cannot be dialled and says why
 * in words somebody can act on ("that has 4"); `phoneDoubt` asks about what is
 * merely surprising. A native `pattern` can only produce "Please match the
 * requested format", which names neither the problem nor the fix, and is the
 * sort of sentence rule 1 exists to keep out of this app.
 */
// Spelled character-for-character the same as the class in
// `contact_number_ok` (schema.sql), so the two can be compared by eye.
export const PHONE_SHAPE_PATTERN = "[0-9 ()+.-]*";

/**
 * The character cap, matching `char_length(value) <= 32` in the same database
 * constraint. It is characters, not digits, which is why it is not 15: a
 * fifteen-digit number written as `+63 917 123 4503` is sixteen characters, and
 * a maxLength of 15 silently truncated the last digit off a number this
 * module's own docblock offers as an example of a valid one.
 */
export const PHONE_MAX_CHARS = 32;

/** What the field says about itself, in this app's words rather than Chrome's. */
export const PHONE_TITLE =
  "Digits, and the spaces, brackets, dots, dashes or leading + people write around them.";

/**
 * What a phone field accepts as it is typed.
 *
 * A LETTER NEVER LANDS IN THE BOX AT ALL, rather than landing and being
 * complained about afterwards. The database now refuses letters outright (see
 * the contact_number_ok constraint in schema.sql), and a rule enforced three
 * screens later, by an error message, is a rule people learn by being told off.
 * Stripping as they type is the same rule applied where it costs nothing.
 *
 * It removes ONLY characters that cannot appear in a phone number. Spaces,
 * brackets, dashes, dots and a leading + all survive, because people write the
 * same number five different ways and every one of them dials.
 */
export const cleanPhoneInput = (value) => String(value ?? "").replace(/[^\d\s()+.-]/g, "");

/** Everything a person legitimately types around the digits. */
const SHAPE = /^[\d\s()+.-]*$/;

const MIN_DIGITS = 7;
const MAX_DIGITS = 15;

/**
 * A reason this cannot be saved, or null.
 *
 * An empty value is NOT a problem here: whether the field is required is the
 * form's question, not this module's, and the two forms disagree (a customer
 * must have a number, a staff account need not).
 */
export function phoneProblem(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (!SHAPE.test(raw)) {
    return "A phone number is digits only — check for stray letters.";
  }

  const digits = phoneDigits(raw);
  if (digits.length < MIN_DIGITS) {
    return `A phone number needs at least ${MIN_DIGITS} digits — that has ${digits.length}.`;
  }
  if (digits.length > MAX_DIGITS) {
    return `That is ${digits.length} digits. No phone number is longer than ${MAX_DIGITS}.`;
  }
  return null;
}

/**
 * A reason to ask about this before saving it, or null.
 *
 * Only ever called on a value that already passed phoneProblem — a number that
 * cannot be saved does not also need a question about it, the same way a Field
 * shows an error OR a hint and never both.
 */
export function phoneDoubt(value) {
  const raw = String(value ?? "").trim();
  if (!raw || phoneProblem(raw)) return null;

  const digits = phoneDigits(raw);

  // 09XXXXXXXXX — the shape almost every number in this business takes.
  if (/^09\d{9}$/.test(digits)) return null;
  // +639XXXXXXXXX / 639XXXXXXXXX — the same number written for abroad.
  if (/^639\d{9}$/.test(digits)) return null;
  // 0 + area code + subscriber: a landline, 8 to 10 digits after the trunk 0.
  if (/^0[2-8]\d{7,9}$/.test(digits)) return null;
  // +63 landline, written internationally.
  if (/^63[2-8]\d{7,9}$/.test(digits)) return null;

  // A near miss on the mobile shape is worth naming precisely — "that is 12
  // digits" tells somebody where to look, where "invalid" does not.
  if (digits.startsWith("09") || digits.startsWith("639")) {
    return `That is ${digits.length} digits — a Philippine mobile number has 11. Save it anyway?`;
  }
  return "That does not look like a Philippine mobile or landline number. Save it anyway?";
}

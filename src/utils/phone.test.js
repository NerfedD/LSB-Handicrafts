import { describe, expect, it } from "vitest";

import {
  cleanPhoneInput,
  localPhoneDigits,
  phoneProblem,
  PHONE_DIGITS,
  PHONE_MAX_CHARS,
  PHONE_SHAPE_PATTERN,
} from "./phone";

/**
 * One shape: eleven digits beginning 09.
 *
 * The numbers below are not invented. Every "already in the database" case was
 * read out of the live project — including the twelve-digit one that got in
 * while nothing was checking, which is now refused rather than asked about.
 */

describe("phoneProblem — what cannot be saved", () => {
  it("passes an empty value through, because required-ness is the form's question", () => {
    expect(phoneProblem("")).toBeNull();
    expect(phoneProblem("   ")).toBeNull();
    expect(phoneProblem(null)).toBeNull();
    expect(phoneProblem(undefined)).toBeNull();
  });

  it("refuses letters", () => {
    expect(phoneProblem("abc")).toMatch(/digits only/);
    expect(phoneProblem("0917 call me")).toMatch(/digits only/);
  });

  it("accepts the one shape, however it was punctuated on the way in", () => {
    for (const number of ["09171234503", "0917 555 0201", "0917-123-4503", "(0917) 123 4503"]) {
      expect(phoneProblem(number), number).toBeNull();
    }
  });

  it("names the count, so somebody knows which digit they dropped", () => {
    expect(phoneProblem("0917123450")).toBe(
      "A phone number is 11 digits beginning 09 — that has 10."
    );
    // The twelve-digit customer record that prompted this rule.
    expect(phoneProblem("091212121212")).toMatch(/that has 12/);
    expect(phoneProblem("0912")).toMatch(/that has 4/);
  });

  it("refuses eleven digits that are not this shop's eleven", () => {
    // Eleven digits, but no Philippine mobile begins 34.
    expect(phoneProblem("34234234324")).toMatch(/begins 09/);
  });

  it("refuses the landlines it used to allow, and says why in a countable way", () => {
    // This is the deliberate cost of the rule. Ten digits, so the message names
    // the count rather than pretending the shape is the problem.
    expect(phoneProblem("(02) 8888 8888")).toMatch(/that has 10/);
    expect(phoneProblem("082 555 0301")).toMatch(/that has 10/);
  });
});

describe("+63 is this shape written for abroad, not a second shape", () => {
  it("is accepted, in every way people punctuate it", () => {
    for (const number of ["+63 917 123 4503", "+639171234503", "639171234503"]) {
      expect(phoneProblem(number), number).toBeNull();
    }
  });

  it("is stored as the 09 form, so two spellings of one number are one value", () => {
    expect(localPhoneDigits("+63 917 123 4503")).toBe("09171234503");
    expect(localPhoneDigits("639171234503")).toBe("09171234503");
    expect(localPhoneDigits("09171234503")).toBe("09171234503");
  });

  it("only ever rewrites a mobile, so it cannot invent a leading zero", () => {
    // 63 followed by something that is not a 9 is left exactly as it is.
    expect(localPhoneDigits("6321234567")).toBe("6321234567");
  });
});

describe("cleanPhoneInput — what a phone box accepts as it is typed", () => {
  it("keeps the digits and absorbs the punctuation people write", () => {
    expect(cleanPhoneInput("0917 555 0201")).toBe("09175550201");
    expect(cleanPhoneInput("(0917) 123-4503")).toBe("09171234503");
    expect(cleanPhoneInput("0917.123.4503")).toBe("09171234503");
  });

  it("drops letters where they are typed, not three screens later", () => {
    expect(cleanPhoneInput("0917 234 5a")).toBe("09172345");
    expect(cleanPhoneInput("call me")).toBe("");
    expect(cleanPhoneInput("09abc17")).toBe("0917");
  });

  it("stops at eleven, so a twelfth digit never lands at all", () => {
    expect(cleanPhoneInput("091212121212")).toBe("09121212121");
    expect(cleanPhoneInput("0917123450399999")).toBe("09171234503");
    expect(cleanPhoneInput("09171234503")).toHaveLength(PHONE_DIGITS);
  });

  it("converts +63 as it is typed, rather than at the end of the form", () => {
    expect(cleanPhoneInput("+63 917 123 4503")).toBe("09171234503");
    // Half-typed: the rewrite lands the moment the 9 does, so the box walks
    // toward the right shape instead of arguing at the end.
    expect(cleanPhoneInput("+6391")).toBe("091");
    expect(cleanPhoneInput("+63")).toBe("63");
  });

  it("survives nothing at all", () => {
    expect(cleanPhoneInput("")).toBe("");
    expect(cleanPhoneInput(null)).toBe("");
    expect(cleanPhoneInput(undefined)).toBe("");
  });

  it("leaves nothing behind that phoneProblem would then refuse for shape", () => {
    // Whatever the box ends up holding is digits, so the only verdict left to
    // reach is the count — never "digits only", which is unreachable by typing.
    for (const typed of ["0917 555 0201", "+63 917 123 4503", "(02) 8888 8888", "abc0917"]) {
      expect(phoneProblem(cleanPhoneInput(typed)) ?? "").not.toMatch(/digits only/);
    }
  });
});

/**
 * The field's own attributes, which have to agree with the function rather than
 * enforce a second, different rule — the failure this file was written after.
 */
describe("the native attributes agree with the rest of the rule", () => {
  // How a browser reads a `pattern`: anchored at both ends, whole value.
  const matchesPattern = (value) =>
    new RegExp(`^(?:${PHONE_SHAPE_PATTERN})$`).test(value);

  it("accepts anything the box can actually contain", () => {
    for (const typed of ["09171234503", "0917 555 0201", "+63 917 123 4503", "(02) 8888 8888"]) {
      const inBox = cleanPhoneInput(typed);
      expect(matchesPattern(inBox), inBox).toBe(true);
    }
  });

  it("still refuses what cannot be part of a phone number", () => {
    expect(matchesPattern("abc")).toBe(false);
    expect(matchesPattern("0917 call me")).toBe(false);
    // Punctuation no longer belongs in the box, so the attribute refuses it
    // too — the box just never contains any to refuse.
    expect(matchesPattern("0917 555 0201")).toBe(false);
  });

  it("leaves the digit count to phoneProblem, which can explain itself", () => {
    // Four digits is not saveable, but the ATTRIBUTE is not what says so — the
    // browser's "Please match the requested format" names neither the problem
    // nor the fix.
    expect(matchesPattern("0912")).toBe(true);
    expect(phoneProblem("0912")).toMatch(/that has 4/);
  });

  it("caps characters well above the digit count, so a paste is not truncated", () => {
    // maxlength is the browser's, applied before cleanPhoneInput ever runs. A
    // cap of 11 would cut "0917 555 0201" down to "0917 555 02" on paste and
    // then clean a number two digits short of the one somebody pasted.
    expect(PHONE_MAX_CHARS).toBe(32);
    expect(PHONE_MAX_CHARS).toBeGreaterThan(PHONE_DIGITS);
    for (const pasted of ["0917 555 0201", "+63 917 123 4503", "(0917) 123-4503"]) {
      expect(pasted.length, pasted).toBeLessThanOrEqual(PHONE_MAX_CHARS);
      expect(cleanPhoneInput(pasted.slice(0, PHONE_MAX_CHARS))).toHaveLength(PHONE_DIGITS);
    }
  });
});

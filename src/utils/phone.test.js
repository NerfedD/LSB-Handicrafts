import { describe, expect, it } from "vitest";

import {
  cleanPhoneInput,
  phoneDoubt,
  phoneProblem,
  PHONE_MAX_CHARS,
  PHONE_SHAPE_PATTERN,
} from "./phone";

/**
 * The cases here are not invented: every "already in the database" number below
 * was read out of the live project. Three of them are the ones that got in
 * because nothing was checking, and they are the reason this module exists.
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

  it("refuses too few and too many digits", () => {
    expect(phoneProblem("0912")).toMatch(/at least 7 digits/);
    expect(phoneProblem("1234567890123456")).toMatch(/longer than 15/);
  });

  it("allows the punctuation people actually type", () => {
    expect(phoneProblem("0917 555 0201")).toBeNull();
    expect(phoneProblem("+63 917 123 4503")).toBeNull();
    expect(phoneProblem("(02) 8888-8888")).toBeNull();
  });
});

describe("phoneDoubt — what is worth asking about", () => {
  it("says nothing about the numbers already in the shop's books", () => {
    for (const number of [
      "09171234503",
      "0917 555 0201",
      "0920 456 7890",
      "+639171234503",
      "+63 917 123 4503",
      "082 555 0301",
      "(02) 8888 8888",
    ]) {
      expect(phoneDoubt(number), number).toBeNull();
    }
  });

  it("asks about the three that got in while nothing was checking", () => {
    // A mobile with one digit too many, and with three too many.
    expect(phoneDoubt("091212121212")).toMatch(/12 digits/);
    expect(phoneDoubt("09121212121212")).toMatch(/14 digits/);
    // Eleven digits, but not a Philippine number in any shape.
    expect(phoneDoubt("34234234324")).toMatch(/does not look like/);
  });

  it("never doubts what it would have refused outright", () => {
    // A field shows an error OR a question, never both — same rule as Field.
    expect(phoneDoubt("abc")).toBeNull();
    expect(phoneDoubt("0912")).toBeNull();
  });

  it("names the digit count on a near miss, so somebody knows where to look", () => {
    expect(phoneDoubt("0917123450")).toBe(
      "That is 10 digits — a Philippine mobile number has 11. Save it anyway?"
    );
  });
});

describe("cleanPhoneInput — what a phone box accepts as it is typed", () => {
  it("drops letters where they are typed, not three screens later", () => {
    expect(cleanPhoneInput("0917 234 5a")).toBe("0917 234 5");
    expect(cleanPhoneInput("call me")).toBe(" ");
    expect(cleanPhoneInput("09abc17")).toBe("0917");
  });

  it("keeps every way people really write a number", () => {
    expect(cleanPhoneInput("+63 917 123 4503")).toBe("+63 917 123 4503");
    expect(cleanPhoneInput("(02) 8888-8888")).toBe("(02) 8888-8888");
    expect(cleanPhoneInput("082.555.0301")).toBe("082.555.0301");
  });

  it("survives nothing at all", () => {
    expect(cleanPhoneInput("")).toBe("");
    expect(cleanPhoneInput(null)).toBe("");
    expect(cleanPhoneInput(undefined)).toBe("");
  });
});

/**
 * The field's own attributes, which are the half of this rule that used to
 * disagree with the other half.
 *
 * `pattern` was `[0-9]{7,15}` — digits only, counting characters — while this
 * module and the contact_number_ok constraint both allow punctuation and count
 * digits. The visible cost was that a number already in the customers table
 * could not be saved back from the screen showing it, so these cases are the
 * ones that were broken, asserted against the attribute rather than the
 * function.
 */
describe("the native attributes agree with the rest of the rule", () => {
  // How a browser reads a `pattern`: anchored at both ends, whole value.
  const matchesPattern = (value) =>
    new RegExp(`^(?:${PHONE_SHAPE_PATTERN})$`).test(value);

  it("accepts every shape phoneProblem accepts", () => {
    for (const number of [
      "09171234503",
      "0917 555 0201",
      "0917 555 0204",
      "+63 917 123 4503",
      "082 555 0301",
      "(02) 8888 8888",
      "(02) 8888-8888",
      "082.555.0301",
    ]) {
      expect(matchesPattern(number), number).toBe(true);
      expect(phoneProblem(number), number).toBeNull();
    }
  });

  it("still refuses what cannot be part of a phone number", () => {
    expect(matchesPattern("abc")).toBe(false);
    expect(matchesPattern("0917 call me")).toBe(false);
  });

  it("leaves the digit count to phoneProblem, which can explain itself", () => {
    // Four digits is not saveable, but the ATTRIBUTE is not what says so — the
    // browser's "Please match the requested format" names neither the problem
    // nor the fix, and rule 1 keeps that sentence out of this app.
    expect(matchesPattern("0912")).toBe(true);
    expect(phoneProblem("0912")).toMatch(/at least 7 digits/);
  });

  it("caps characters where the database caps them, not at the digit count", () => {
    // 15 digits written internationally is 16 characters. A maxLength of 15
    // silently truncated the last digit off a number this module documents as
    // valid.
    expect("+63 917 123 4503".length).toBeGreaterThan(15);
    expect(PHONE_MAX_CHARS).toBe(32);
    expect("+63 917 123 4503".length).toBeLessThanOrEqual(PHONE_MAX_CHARS);
  });
});

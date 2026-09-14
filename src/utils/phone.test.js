import { describe, expect, it } from "vitest";

import { cleanPhoneInput, phoneDoubt, phoneProblem } from "./phone";

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

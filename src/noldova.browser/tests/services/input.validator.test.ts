/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ArgumentMissingException } from "../../src/exceptions/argument-missing.exception.ts";
import { ArgumentNotFlagException } from "../../src/exceptions/argument-not-flag.exception.ts";
import { ArgumentNotIndexException } from "../../src/exceptions/argument-not-index.exception.ts";
import { ArgumentNotOneOfException } from "../../src/exceptions/argument-not-one-of.exception.ts";
import { ArgumentNotTextException } from "../../src/exceptions/argument-not-text.exception.ts";
import { ArgumentNotWholeNumberException } from "../../src/exceptions/argument-not-whole-number.exception.ts";
import { ArgumentTooLargeException } from "../../src/exceptions/argument-too-large.exception.ts";
import { ArgumentTooLongException } from "../../src/exceptions/argument-too-long.exception.ts";
import { ArgumentsNotObjectException } from "../../src/exceptions/arguments-not-object.exception.ts";
import { ExactlyOneArgumentException } from "../../src/exceptions/exactly-one-argument.exception.ts";
import type { InvalidInputException } from "../../src/exceptions/invalid-input.exception.ts";
import { UrlCredentialsException } from "../../src/exceptions/url-credentials.exception.ts";
import { UrlInvalidException } from "../../src/exceptions/url-invalid.exception.ts";
import { UrlSchemeException } from "../../src/exceptions/url-scheme.exception.ts";
import { InputValidator } from "../../src/services/input.validator.ts";

function failureOf(read: () => unknown): unknown {
  try {
    read();
  }
  catch (error) {
    return error;
  }
  return expect.fail("The input was accepted.");
}

function expectInvalid(read: () => unknown, type: new (...args: never[]) => InvalidInputException, message: string): void {
  const failure: unknown = failureOf(read);
  expect(failure).toBeInstanceOf(type);
  expect(failure).toMatchObject({ reason: "Refused", moduleCode: null, message });
}

describe("InputValidator", () => {
  it("takes an object and refuses anything else", () => {
    expect(InputValidator.readObject({ url: "https://example.test" })).toEqual({ url: "https://example.test" });
    for (const value of [null, "text", 3, true, []])
      expectInvalid(() => InputValidator.readObject(value), ArgumentsNotObjectException, "The arguments must be an object.");
  });

  it("reads the one argument a call gives of a group, and refuses none or more than one", () => {
    const choices: readonly string[] = ["url", "action"];

    expect(InputValidator.readExactlyOne({ url: "https://example.test" }, choices)).toBe("url");
    expect(InputValidator.readExactlyOne({ action: "back", other: 1 }, choices)).toBe("action");
    expectInvalid(() => InputValidator.readExactlyOne({}, choices), ExactlyOneArgumentException, "Give exactly one of the arguments \"url\", \"action\".");
    expectInvalid(() => InputValidator.readExactlyOne({ url: "https://example.test", action: "back" }, choices), ExactlyOneArgumentException, "Give exactly one of the arguments \"url\", \"action\".");
  });

  it("reads text within its length", () => {
    expect(InputValidator.readText({ text: "hello" }, "text", 5)).toBe("hello");
    expectInvalid(() => InputValidator.readText({}, "text", 5), ArgumentMissingException, "The argument \"text\" is missing.");
    expectInvalid(() => InputValidator.readText({ text: 5 }, "text", 5), ArgumentNotTextException, "The argument \"text\" must be text.");
    expectInvalid(() => InputValidator.readText({ text: "hello!" }, "text", 5), ArgumentTooLongException, "The argument \"text\" is longer than 5 characters.");
  });

  it("reads an http or https URL and gives it back normalized", () => {
    expect(InputValidator.readUrl({ url: "https://Example.test/a b" }, "url")).toBe("https://example.test/a%20b");
    expect(InputValidator.readUrl({ url: "http://127.0.0.1:8080" }, "url")).toBe("http://127.0.0.1:8080/");
  });

  it("refuses a URL that isn't valid, isn't on the web or carries credentials", () => {
    expectInvalid(() => InputValidator.readUrl({ url: "not a url" }, "url"), UrlInvalidException, "The URL isn't valid.");
    for (const url of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "ftp://example.test"])
      expectInvalid(() => InputValidator.readUrl({ url }, "url"), UrlSchemeException, "Only http and https URLs can be opened.");
    expectInvalid(() => InputValidator.readUrl({ url: "https://user@example.test" }, "url"), UrlCredentialsException, "A URL can't carry a user name or password.");
    expectInvalid(() => InputValidator.readUrl({ url: "https://:secret@example.test" }, "url"), UrlCredentialsException, "A URL can't carry a user name or password.");
  });

  it("refuses a URL over the length limit", () => {
    const url: string = `https://example.test/${"a".repeat(32768)}`;

    expectInvalid(() => InputValidator.readUrl({ url }, "url"), ArgumentTooLongException, "The argument \"url\" is longer than 32768 characters.");
  });

  it("reads a wait of whole milliseconds up to the limit", () => {
    expect(InputValidator.readMilliseconds({ timeout: 1 }, "timeout")).toBe(1);
    expect(InputValidator.readMilliseconds({ timeout: 30000 }, "timeout")).toBe(30000);
    expectInvalid(() => InputValidator.readMilliseconds({}, "timeout"), ArgumentMissingException, "The argument \"timeout\" is missing.");
    for (const timeout of [0, -1, 1.5, "10", Number.MAX_SAFE_INTEGER + 2])
      expectInvalid(() => InputValidator.readMilliseconds({ timeout }, "timeout"), ArgumentNotWholeNumberException, "The argument \"timeout\" must be a whole number of at least 1.");
    expectInvalid(() => InputValidator.readMilliseconds({ timeout: 30001 }, "timeout"), ArgumentTooLargeException, "The argument \"timeout\" is more than 30000.");
  });

  it("reads an optional choice, count or flag, with its fallback when the call leaves it out", () => {
    expect([
      InputValidator.readChoice({}, "button", ["left", "right"], "left"),
      InputValidator.readChoice({ button: "right" }, "button", ["left", "right"], "left"),
      InputValidator.readCount({}, "clickCount", 3, 1),
      InputValidator.readCount({ clickCount: 3 }, "clickCount", 3, 1),
      InputValidator.readFlag({}, "submit"),
      InputValidator.readFlag({ submit: true }, "submit")
    ]).toEqual(["left", "right", 1, 3, false, true]);
  });

  it("refuses a choice, count or flag of the wrong kind or out of range", () => {
    const cases: readonly [() => unknown, new (...args: never[]) => InvalidInputException, string][] = [
      [() => InputValidator.readChoice({ button: "side" }, "button", ["left"], "left"), ArgumentNotOneOfException, "The argument \"button\" must be one of left."],
      [() => InputValidator.readChoice({ button: 1 }, "button", ["left"], "left"), ArgumentNotOneOfException, "The argument \"button\" must be one of left."],
      [() => InputValidator.readCount({ clickCount: "2" }, "clickCount", 3, 1), ArgumentNotWholeNumberException, "The argument \"clickCount\" must be a whole number of at least 1."],
      [() => InputValidator.readCount({ clickCount: 0 }, "clickCount", 3, 1), ArgumentNotWholeNumberException, "The argument \"clickCount\" must be a whole number of at least 1."],
      [() => InputValidator.readCount({ clickCount: 2.5 }, "clickCount", 3, 1), ArgumentNotWholeNumberException, "The argument \"clickCount\" must be a whole number of at least 1."],
      [() => InputValidator.readCount({ clickCount: 4 }, "clickCount", 3, 1), ArgumentTooLargeException, "The argument \"clickCount\" is more than 3."],
      [() => InputValidator.readFlag({ submit: "yes" }, "submit"), ArgumentNotFlagException, "The argument \"submit\" must be true or false."]
    ];
    for (const [read, type, message] of cases)
      expectInvalid(read, type, message);
  });

  it("reads an index of a whole number from 0, and refuses anything else", () => {
    expect([InputValidator.readIndex({ cursor: 0 }, "cursor"), InputValidator.readIndex({ cursor: 7 }, "cursor")]).toEqual([0, 7]);
    expectInvalid(() => InputValidator.readIndex({}, "cursor"), ArgumentNotIndexException, "The argument \"cursor\" must be a whole number of at least 0.");
    for (const cursor of [-1, 1.5, "3"])
      expectInvalid(() => InputValidator.readIndex({ cursor }, "cursor"), ArgumentNotIndexException, "The argument \"cursor\" must be a whole number of at least 0.");
  });
});

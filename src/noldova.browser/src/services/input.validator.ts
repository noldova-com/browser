/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentMissingException } from "../exceptions/argument-missing.exception.ts";
import { ArgumentNotFlagException } from "../exceptions/argument-not-flag.exception.ts";
import { ArgumentNotIndexException } from "../exceptions/argument-not-index.exception.ts";
import { ArgumentNotOneOfException } from "../exceptions/argument-not-one-of.exception.ts";
import { ArgumentNotTextException } from "../exceptions/argument-not-text.exception.ts";
import { ArgumentNotWholeNumberException } from "../exceptions/argument-not-whole-number.exception.ts";
import { ArgumentTooLargeException } from "../exceptions/argument-too-large.exception.ts";
import { ArgumentTooLongException } from "../exceptions/argument-too-long.exception.ts";
import { ArgumentsNotObjectException } from "../exceptions/arguments-not-object.exception.ts";
import { ExactlyOneArgumentException } from "../exceptions/exactly-one-argument.exception.ts";
import { UrlCredentialsException } from "../exceptions/url-credentials.exception.ts";
import { UrlInvalidException } from "../exceptions/url-invalid.exception.ts";
import { UrlSchemeException } from "../exceptions/url-scheme.exception.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { JsonShapes } from "./json-shapes.ts";

export class InputValidator {
  public static readObject(value: JsonValue): JsonObject {
    if (!JsonShapes.isObject(value))
      throw new ArgumentsNotObjectException();
    return value;
  }

  public static readExactlyOne(input: JsonObject, names: readonly string[]): string {
    const given: readonly string[] = names.filter(t => input[t] !== undefined);
    const name: string | undefined = given[0];
    if (given.length !== 1 || name === undefined)
      throw new ExactlyOneArgumentException(names);
    return name;
  }

  public static readText(input: JsonObject, name: string, maximumLength: number): string {
    const value: JsonValue | undefined = input[name];
    if (value === undefined)
      throw new ArgumentMissingException(name);
    if (typeof value !== "string")
      throw new ArgumentNotTextException(name);
    // The schema's maxLength counts code points, so text of more UTF-16 units than its limit can still be within it.
    if (value.length > maximumLength && [...value].length > maximumLength)
      throw new ArgumentTooLongException(name, maximumLength);
    return value;
  }

  public static readUrl(input: JsonObject, name: string): string {
    const url: URL | null = URL.parse(InputValidator.readText(input, name, BrowserLimits.maximumUrlLength));
    if (url === null)
      throw new UrlInvalidException();
    if (!Resources.webSchemes.includes(url.protocol))
      throw new UrlSchemeException();
    if (url.username !== "" || url.password !== "")
      throw new UrlCredentialsException();
    return url.href;
  }

  public static readChoice(input: JsonObject, name: string, values: readonly string[], fallback: string): string {
    const value: JsonValue = input[name] ?? fallback;
    if (typeof value !== "string" || !values.includes(value))
      throw new ArgumentNotOneOfException(name, values);
    return value;
  }

  public static readCount(input: JsonObject, name: string, maximum: number, fallback: number): number {
    const value: JsonValue = input[name] ?? fallback;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
      throw new ArgumentNotWholeNumberException(name);
    if (value > maximum)
      throw new ArgumentTooLargeException(name, maximum);
    return value;
  }

  public static readIndex(input: JsonObject, name: string): number {
    const value: JsonValue | undefined = input[name];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
      throw new ArgumentNotIndexException(name);
    return value;
  }

  public static readFlag(input: JsonObject, name: string): boolean {
    const value: JsonValue = input[name] ?? false;
    if (typeof value !== "boolean")
      throw new ArgumentNotFlagException(name);
    return value;
  }

  public static readMilliseconds(input: JsonObject, name: string): number {
    const value: JsonValue | undefined = input[name];
    if (value === undefined)
      throw new ArgumentMissingException(name);
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
      throw new ArgumentNotWholeNumberException(name);
    if (value > BrowserLimits.maximumWaitMilliseconds)
      throw new ArgumentTooLargeException(name, BrowserLimits.maximumWaitMilliseconds);
    return value;
  }
}

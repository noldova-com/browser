/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { PageRefusal } from "../../src/models/page-refusal.ts";

describe("PageRefusal", () => {
  it("reads its wire form and writes the same, for http and https", () => {
    const refusals: readonly PageRefusal[] = [
      PageRefusal.fromJson({ url: "https://docs.example.com/pricing", origin: "https://docs.example.com" }),
      PageRefusal.fromJson({ url: "http://example.com:8080/a?b#c", origin: "http://example.com:8080" })
    ];

    expect(refusals.map(t => [t instanceof PageRefusal, t.url, t.origin, t.toJson()])).toEqual([
      [true, "https://docs.example.com/pricing", "https://docs.example.com", { url: "https://docs.example.com/pricing", origin: "https://docs.example.com" }],
      [true, "http://example.com:8080/a?b#c", "http://example.com:8080", { url: "http://example.com:8080/a?b#c", origin: "http://example.com:8080" }]
    ]);
  });

  it.each([
    ["url", { origin: "https://example.com" }],
    ["origin", { url: "https://example.com/" }],
    ["url", { url: 1, origin: "https://example.com" }],
    ["origin", { url: "https://example.com/", origin: null }],
    ["url", { url: "not an address", origin: "https://example.com" }],
    ["url", { url: "file:///etc/hosts", origin: "null" }],
    ["origin", { url: "https://example.com/", origin: "https://example.org" }],
    ["reason", { url: "https://example.com/", origin: "https://example.com", reason: "Denied" }]
  ])("refuses a wire form with a missing, wrong or unknown %s, at the field's path", (field, value) => {
    expect(() => PageRefusal.fromJson(value, "$.refusal")).toThrow(JsonException);
    expect(() => PageRefusal.fromJson(value, "$.refusal")).toThrow(`$.refusal.${field}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => PageRefusal.fromJson("https://example.com/")).toThrow("$: ");
  });

  it.each([
    ["url", "ftp://example.com/", "ftp://example.com"],
    ["url", "", ""],
    ["origin", "https://example.com/a", "https://example.com/"]
  ])("refuses to make a refusal with a wrong %s", (field, url, origin) => {
    expect(() => new PageRefusal(url, origin)).toThrow(ArgumentException);
    expect(() => new PageRefusal(url, origin)).toThrow(`(Parameter '${field}')`);
  });
});

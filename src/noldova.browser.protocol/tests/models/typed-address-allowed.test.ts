/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { TypedAddressAllowed } from "../../src/models/typed-address-allowed.ts";

describe("TypedAddressAllowed", () => {
  it("reads its wire form and writes the same, its kind fixed to Allowed", () => {
    const allowed: TypedAddressAllowed = TypedAddressAllowed.fromJson({ kind: "Allowed", origin: "https://example.com" });

    expect([allowed instanceof TypedAddressAllowed, allowed.kind, allowed.origin, allowed.toJson()])
      .toEqual([true, "Allowed", "https://example.com", { kind: "Allowed", origin: "https://example.com" }]);
    expect(new TypedAddressAllowed("https://example.org").kind).toBe("Allowed");
  });

  it.each([
    ["kind", { origin: "https://example.com" }],
    ["origin", { kind: "Allowed" }],
    ["kind", { kind: "Refused", origin: "https://example.com" }],
    ["kind", { kind: 1, origin: "https://example.com" }],
    ["origin", { kind: "Allowed", origin: null }],
    ["reason", { kind: "Allowed", origin: "https://example.com", reason: "Local" }]
  ])("refuses a wire form with a missing, wrong or unknown %s, at the field's path", (field, value) => {
    expect(() => TypedAddressAllowed.fromJson(value)).toThrow(JsonException);
    expect(() => TypedAddressAllowed.fromJson(value)).toThrow(`$.${field}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => TypedAddressAllowed.fromJson("Allowed")).toThrow("$: ");
  });
});

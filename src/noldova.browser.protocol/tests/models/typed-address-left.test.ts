/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { TypedAddressLeft } from "../../src/models/typed-address-left.ts";

describe("TypedAddressLeft", () => {
  it("reads its wire form and writes the same, its kind fixed to Left", () => {
    const left: TypedAddressLeft = TypedAddressLeft.fromJson({ kind: "Left" });

    expect([left instanceof TypedAddressLeft, left.kind, left.toJson()]).toEqual([true, "Left", { kind: "Left" }]);
    expect(new TypedAddressLeft().kind).toBe("Left");
  });

  it.each([
    ["kind", {}],
    ["kind", { kind: "Allowed" }],
    ["kind", { kind: 1 }],
    ["reason", { kind: "Left", reason: "Local" }]
  ])("refuses a wire form with a missing, wrong or unknown %s, at the field's path", (field, value) => {
    expect(() => TypedAddressLeft.fromJson(value)).toThrow(JsonException);
    expect(() => TypedAddressLeft.fromJson(value)).toThrow(`$.${field}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => TypedAddressLeft.fromJson("Left")).toThrow("$: ");
  });
});

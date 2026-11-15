/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { TypedAddressRefusal } from "../../src/enums/typed-address-refusal.ts";
import { TypedAddressRefused } from "../../src/models/typed-address-refused.ts";

describe("TypedAddressRefused", () => {
  it.each(Object.values(TypedAddressRefusal))("reads its wire form for %s and writes the same, its kind fixed to Refused", reason => {
    const refused: TypedAddressRefused = TypedAddressRefused.fromJson({ kind: "Refused", reason });

    expect([refused instanceof TypedAddressRefused, refused.kind, refused.reason, refused.toJson()]).toEqual([true, "Refused", reason, { kind: "Refused", reason }]);
  });

  it.each([
    ["kind", { reason: "Local" }],
    ["reason", { kind: "Refused" }],
    ["kind", { kind: "Allowed", reason: "Local" }],
    ["kind", { kind: null, reason: "Local" }],
    ["reason", { kind: "Refused", reason: "failed" }],
    ["reason", { kind: "Refused", reason: 1 }],
    ["origin", { kind: "Refused", reason: "Local", origin: "https://example.com" }]
  ])("refuses a wire form with a missing, wrong or unknown %s, at the field's path", (field, value) => {
    expect(() => TypedAddressRefused.fromJson(value, "$.answer")).toThrow(JsonException);
    expect(() => TypedAddressRefused.fromJson(value, "$.answer")).toThrow(`$.answer.${field}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => TypedAddressRefused.fromJson(null)).toThrow("$: ");
  });
});

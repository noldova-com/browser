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
import { TypedAddressLeft } from "../../src/models/typed-address-left.ts";
import { TypedAddressRefused } from "../../src/models/typed-address-refused.ts";
import { TypedAddressAnswerReader } from "../../src/services/typed-address-answer.reader.ts";
import type { TypedAddressAnswer } from "../../src/types/typed-address-answer.ts";

describe("TypedAddressAnswerReader", () => {
  it("reads an allowed answer, a refused one and a left one as their classes, by kind", () => {
    const answers: readonly TypedAddressAnswer[] = [
      TypedAddressAnswerReader.read({ kind: "Allowed", origin: "https://example.com" }),
      TypedAddressAnswerReader.read({ kind: "Refused", reason: "NeverAllowed" }),
      TypedAddressAnswerReader.read({ kind: "Left" })
    ];

    expect(answers.map(t => [t instanceof TypedAddressAllowed, t instanceof TypedAddressRefused, t instanceof TypedAddressLeft, t.toJson()])).toEqual([
      [true, false, false, { kind: "Allowed", origin: "https://example.com" }],
      [false, true, false, { kind: "Refused", reason: "NeverAllowed" }],
      [false, false, true, { kind: "Left" }]
    ]);
  });

  it.each([
    ["kind", { origin: "https://example.com" }],
    ["kind", { kind: "Maybe", origin: "https://example.com" }],
    ["kind", { kind: 1, reason: "Local" }],
    ["origin", { kind: "Allowed" }],
    ["reason", { kind: "Refused" }],
    ["origin", { kind: "Refused", reason: "Local", origin: "https://example.com" }],
    ["reason", { kind: "Refused", reason: "failed" }],
    ["origin", { kind: "Left", origin: "https://example.com" }]
  ])("refuses an answer with a missing, wrong or unknown %s, at the field's path", (field, value) => {
    expect(() => TypedAddressAnswerReader.read(value, "$.answer")).toThrow(JsonException);
    expect(() => TypedAddressAnswerReader.read(value, "$.answer")).toThrow(`$.answer.${field}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => TypedAddressAnswerReader.read([])).toThrow("$: ");
  });
});

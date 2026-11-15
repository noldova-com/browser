/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { JsonShapes } from "../../src/services/json-shapes.ts";
import type { JsonValue } from "../../src/types/json-value.ts";

describe("JsonShapes", () => {
  const VALUES: readonly (JsonValue | undefined)[] = [{}, { a: 1 }, [], [1], null, undefined, "text", 1, true];

  it("takes only a plain object as an object, never an array or null", () => {
    expect(VALUES.map(t => JsonShapes.isObject(t))).toEqual([true, true, false, false, false, false, false, false, false]);
  });

  it("takes only an array as an array", () => {
    expect(VALUES.map(t => JsonShapes.isArray(t))).toEqual([false, false, true, true, false, false, false, false, false]);
  });
});

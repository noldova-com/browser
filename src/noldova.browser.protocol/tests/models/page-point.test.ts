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

import { PagePoint } from "../../src/models/page-point.ts";

describe("PagePoint", () => {
  it("reads its wire form and writes the same", () => {
    const point: PagePoint = PagePoint.fromJson({ x: 168, y: -3.5 });

    expect([point, [point.x, point.y], point.toJson()]).toEqual([expect.any(PagePoint), [168, -3.5], { x: 168, y: -3.5 }]);
  });

  it.each([
    ["x", { y: 1 }],
    ["y", { x: 1 }],
    ["x", { x: "1", y: 1 }],
    ["y", { x: 1, y: null }],
    ["z", { x: 1, y: 1, z: 1 }]
  ])("refuses a wire form with a missing, wrong or unknown %s, at the field's path", (field, value) => {
    expect(() => PagePoint.fromJson(value, "$.point")).toThrow(JsonException);
    expect(() => PagePoint.fromJson(value, "$.point")).toThrow(`$.point.${field}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => PagePoint.fromJson(null)).toThrow("$: ");
  });

  it.each([["x", Number.NaN, 0], ["y", 0, Number.NEGATIVE_INFINITY]] as const)("refuses to make a point with a coordinate %s that isn't finite", (field, x, y) => {
    expect(() => new PagePoint(x, y)).toThrow(ArgumentException);
    expect(() => new PagePoint(x, y)).toThrow(`(Parameter '${field}')`);
  });
});

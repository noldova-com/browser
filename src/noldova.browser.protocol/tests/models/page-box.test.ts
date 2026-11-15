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

import { PageBox } from "../../src/models/page-box.ts";

describe("PageBox", () => {
  it("reads its wire form and writes the same", () => {
    const box: PageBox = PageBox.fromJson({ x: -8, y: 340.5, width: 0, height: 32 });

    expect([box, [box.x, box.y, box.width, box.height], box.toJson()]).toEqual([expect.any(PageBox), [-8, 340.5, 0, 32], { x: -8, y: 340.5, width: 0, height: 32 }]);
  });

  it.each([
    ["x", { y: 1, width: 1, height: 1 }],
    ["y", { x: 1, width: 1, height: 1 }],
    ["width", { x: 1, y: 1, height: 1 }],
    ["height", { x: 1, y: 1, width: 1 }],
    ["x", { x: "1", y: 1, width: 1, height: 1 }],
    ["y", { x: 1, y: null, width: 1, height: 1 }],
    ["width", { x: 1, y: 1, width: true, height: 1 }],
    ["height", { x: 1, y: 1, width: 1, height: [] }],
    ["width", { x: 1, y: 1, width: -1, height: 1 }],
    ["height", { x: 1, y: 1, width: 1, height: -0.5 }],
    ["depth", { x: 1, y: 1, width: 1, height: 1, depth: 1 }]
  ])("refuses a wire form with a missing, wrong or unknown %s, at the field's path", (field, value) => {
    expect(() => PageBox.fromJson(value, "$.box")).toThrow(JsonException);
    expect(() => PageBox.fromJson(value, "$.box")).toThrow(`$.box.${field}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => PageBox.fromJson([1, 2, 3, 4])).toThrow("$: ");
  });

  it.each([
    ["x", [Number.NaN, 0, 0, 0]],
    ["y", [0, Number.POSITIVE_INFINITY, 0, 0]],
    ["width", [0, 0, -1, 0]],
    ["width", [0, 0, Number.NaN, 0]],
    ["height", [0, 0, 0, -1]],
    ["height", [0, 0, 0, Number.POSITIVE_INFINITY]]
  ] as const)("refuses to make a box with a wrong %s", (field, [x, y, width, height]) => {
    expect(() => new PageBox(x, y, width, height)).toThrow(ArgumentException);
    expect(() => new PageBox(x, y, width, height)).toThrow(`(Parameter '${field}')`);
  });

  it("tells a box of the same edges and size from one that differs in any", () => {
    const box: PageBox = new PageBox(1, 2, 3, 4);

    expect([new PageBox(1, 2, 3, 4), new PageBox(0, 2, 3, 4), new PageBox(1, 0, 3, 4), new PageBox(1, 2, 0, 4), new PageBox(1, 2, 3, 0)].map(t => box.isSame(t)))
      .toEqual([true, false, false, false, false]);
  });
});

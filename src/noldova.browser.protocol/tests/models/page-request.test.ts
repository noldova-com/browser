/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { PageRequest } from "../../src/models/page-request.ts";

describe("PageRequest", () => {
  it("reads its wire form and writes the same", () => {
    const request: PageRequest = PageRequest.fromJson({ instance: "0f8fad5b-d9cb-469f-a165-70867728950e" });

    expect([request, request.instance, request.toJson()])
      .toEqual([expect.any(PageRequest), "0f8fad5b-d9cb-469f-a165-70867728950e", { instance: "0f8fad5b-d9cb-469f-a165-70867728950e" }]);
  });

  it.each([
    ["instance", {}],
    ["instance", { instance: 7 }],
    ["profileKey", { instance: "page", profileKey: "folder-1" }]
  ])("refuses a wire form with a missing, wrong or unknown %s, at the field's path", (field, value) => {
    expect(() => PageRequest.fromJson(value)).toThrow(JsonException);
    expect(() => PageRequest.fromJson(value)).toThrow(`$.${field}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => PageRequest.fromJson("page")).toThrow("$: ");
  });
});

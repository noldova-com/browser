/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { OpenPagesRequest } from "../../src/models/open-pages-request.ts";

describe("OpenPagesRequest", () => {
  it("reads its wire form and writes the same", () => {
    const request: OpenPagesRequest = OpenPagesRequest.fromJson({ instances: ["0f8fad5b-d9cb-469f-a165-70867728950e"] });

    expect([request, request.instances, request.toJson()])
      .toEqual([expect.any(OpenPagesRequest), ["0f8fad5b-d9cb-469f-a165-70867728950e"], { instances: ["0f8fad5b-d9cb-469f-a165-70867728950e"] }]);
  });

  it.each([
    ["$.instances", {}],
    ["$.instances", { instances: null }],
    ["$.instances.0", { instances: [{}] }],
    ["$.window", { instances: [], window: 1 }]
  ])("refuses a wire form with a missing, wrong or unknown field, at %s", (path, value) => {
    expect(() => OpenPagesRequest.fromJson(value)).toThrow(JsonException);
    expect(() => OpenPagesRequest.fromJson(value)).toThrow(`${path}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => OpenPagesRequest.fromJson(["page"])).toThrow("$: ");
  });
});

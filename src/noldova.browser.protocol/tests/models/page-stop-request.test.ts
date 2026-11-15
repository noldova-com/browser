/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { PageStopRequest } from "../../src/models/page-stop-request.ts";

const INSTANCE: string = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("PageStopRequest", () => {
  it("reads its wire form and writes the same", () => {
    const request: PageStopRequest = PageStopRequest.fromJson({ instance: INSTANCE, isTakingOver: true });

    expect([request, request.instance, request.isTakingOver, request.toJson()])
      .toEqual([expect.any(PageStopRequest), INSTANCE, true, { instance: INSTANCE, isTakingOver: true }]);
  });

  it.each([
    ["instance", { isTakingOver: false }],
    ["isTakingOver", { instance: INSTANCE }],
    ["instance", { instance: null, isTakingOver: false }],
    ["isTakingOver", { instance: INSTANCE, isTakingOver: "no" }],
    ["session", { instance: INSTANCE, isTakingOver: false, session: "a" }]
  ])("refuses a wire form with a missing, wrong or unknown %s, at the field's path", (field, value) => {
    expect(() => PageStopRequest.fromJson(value)).toThrow(JsonException);
    expect(() => PageStopRequest.fromJson(value)).toThrow(`$.${field}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => PageStopRequest.fromJson(true)).toThrow("$: ");
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { BrowsingDataRequest } from "../../src/models/browsing-data-request.ts";

describe("BrowsingDataRequest", () => {
  it("reads its wire form and writes the same", () => {
    const request: BrowsingDataRequest = BrowsingDataRequest.fromJson({ profileKey: "folder-1" });

    expect([request, request.profileKey, request.toJson()]).toEqual([expect.any(BrowsingDataRequest), "folder-1", { profileKey: "folder-1" }]);
  });

  it.each([
    ["profileKey", {}],
    ["profileKey", { profileKey: [] }],
    ["instance", { profileKey: "folder-1", instance: "page" }]
  ])("refuses a wire form with a missing, wrong or unknown %s, at the field's path", (field, value) => {
    expect(() => BrowsingDataRequest.fromJson(value)).toThrow(JsonException);
    expect(() => BrowsingDataRequest.fromJson(value)).toThrow(`$.${field}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => BrowsingDataRequest.fromJson(undefined)).toThrow("$: ");
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { TypedAddressRequest } from "../../src/models/typed-address-request.ts";

describe("TypedAddressRequest", () => {
  it("reads its wire form and writes the same", () => {
    const request: TypedAddressRequest = TypedAddressRequest.fromJson({ profileKey: "folder-1", url: "https://example.com/docs" });

    expect([request, request.profileKey, request.url, request.toJson()])
      .toEqual([expect.any(TypedAddressRequest), "folder-1", "https://example.com/docs", { profileKey: "folder-1", url: "https://example.com/docs" }]);
    expect(request.instance).toBeNull();
  });

  it("reads and writes the pane's page instance when it has one", () => {
    const request: TypedAddressRequest = TypedAddressRequest.fromJson({ profileKey: "folder-1", url: "https://example.com/docs", instance: "page-1" });

    expect([request.instance, request.toJson(), new TypedAddressRequest("folder-1", "https://example.com/", "page-2").toJson()]).toEqual([
      "page-1",
      { profileKey: "folder-1", url: "https://example.com/docs", instance: "page-1" },
      { profileKey: "folder-1", url: "https://example.com/", instance: "page-2" }
    ]);
  });

  it.each([
    ["profileKey", { url: "https://example.com/" }],
    ["url", { profileKey: "folder-1" }],
    ["profileKey", { profileKey: 1, url: "https://example.com/" }],
    ["url", { profileKey: "folder-1", url: null }],
    ["instance", { profileKey: "folder-1", url: "https://example.com/", instance: 1 }],
    ["origin", { profileKey: "folder-1", url: "https://example.com/", origin: "https://example.com" }]
  ])("refuses a wire form with a missing, wrong or unknown %s, at the field's path", (field, value) => {
    expect(() => TypedAddressRequest.fromJson(value)).toThrow(JsonException);
    expect(() => TypedAddressRequest.fromJson(value)).toThrow(`$.${field}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => TypedAddressRequest.fromJson("https://example.com/")).toThrow("$: ");
  });
});

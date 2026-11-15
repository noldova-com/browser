/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { TypedRedirectRequest } from "../../src/models/typed-redirect-request.ts";

const INSTANCE: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
const URL_TEXT: string = "https://www.example.com/";

describe("TypedRedirectRequest", () => {
  it("reads its wire form and writes the same", () => {
    const request: TypedRedirectRequest = TypedRedirectRequest.fromJson({ instance: INSTANCE, profileKey: "folder-1", url: URL_TEXT });

    expect([request, request.instance, request.profileKey, request.url, request.toJson()])
      .toEqual([expect.any(TypedRedirectRequest), INSTANCE, "folder-1", URL_TEXT, { instance: INSTANCE, profileKey: "folder-1", url: URL_TEXT }]);
  });

  it.each([
    ["instance", { profileKey: "folder-1", url: URL_TEXT }],
    ["profileKey", { instance: INSTANCE, url: URL_TEXT }],
    ["url", { instance: INSTANCE, profileKey: "folder-1" }],
    ["instance", { instance: 1, profileKey: "folder-1", url: URL_TEXT }],
    ["profileKey", { instance: INSTANCE, profileKey: {}, url: URL_TEXT }],
    ["url", { instance: INSTANCE, profileKey: "folder-1", url: [] }],
    ["origin", { instance: INSTANCE, profileKey: "folder-1", url: URL_TEXT, origin: "https://www.example.com" }]
  ])("refuses a wire form with a missing, wrong or unknown %s, at the field's path", (field, value) => {
    expect(() => TypedRedirectRequest.fromJson(value)).toThrow(JsonException);
    expect(() => TypedRedirectRequest.fromJson(value)).toThrow(`$.${field}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => TypedRedirectRequest.fromJson(0)).toThrow("$: ");
  });
});

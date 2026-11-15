/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { PageRecord } from "../../src/models/page-record.ts";

const INSTANCE: string = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("PageRecord", () => {
  it("reads its wire form and writes the same, an empty address too", () => {
    const record: PageRecord = PageRecord.fromJson({ instance: INSTANCE, profileKey: "folder-1", url: "" });

    expect([record, [record.instance, record.profileKey, record.url], record.toJson()])
      .toEqual([expect.any(PageRecord), [INSTANCE, "folder-1", ""], { instance: INSTANCE, profileKey: "folder-1", url: "" }]);
  });

  it.each([
    ["instance", { profileKey: "folder-1", url: "" }],
    ["profileKey", { instance: INSTANCE, url: "" }],
    ["url", { instance: INSTANCE, profileKey: "folder-1" }],
    ["instance", { instance: 1, profileKey: "folder-1", url: "" }],
    ["profileKey", { instance: INSTANCE, profileKey: null, url: "" }],
    ["url", { instance: INSTANCE, profileKey: "folder-1", url: false }],
    ["title", { instance: INSTANCE, profileKey: "folder-1", url: "", title: "Docs" }]
  ])("refuses a wire form with a missing, wrong or unknown %s, at the field's path", (field, value) => {
    expect(() => PageRecord.fromJson(value, "$.record")).toThrow(JsonException);
    expect(() => PageRecord.fromJson(value, "$.record")).toThrow(`$.record.${field}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => PageRecord.fromJson(1)).toThrow("$: ");
  });
});

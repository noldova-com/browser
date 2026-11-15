/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { PageClaim } from "../../src/models/page-claim.ts";
import { PageRecord } from "../../src/models/page-record.ts";

const RECORD = { instance: "0f8fad5b-d9cb-469f-a165-70867728950e", profileKey: "folder-1", url: "https://docs.example.com/" };

describe("PageClaim", () => {
  it("reads its wire form with a record and an agent or neither, and writes the same", () => {
    const claims: readonly PageClaim[] = [
      PageClaim.fromJson({ isClaimed: true, isHere: true, record: RECORD, agentName: "Scout" }),
      PageClaim.fromJson({ isClaimed: false, isHere: false, record: null, agentName: null })
    ];

    expect(claims.map(t => [t instanceof PageClaim, t.isClaimed, t.isHere, t.record instanceof PageRecord, t.agentName, t.toJson()])).toEqual([
      [true, true, true, true, "Scout", { isClaimed: true, isHere: true, record: RECORD, agentName: "Scout" }],
      [true, false, false, false, null, { isClaimed: false, isHere: false, record: null, agentName: null }]
    ]);
  });

  it.each([
    ["isClaimed", { isHere: false, record: null, agentName: null }],
    ["isHere", { isClaimed: true, record: null, agentName: null }],
    ["record", { isClaimed: true, isHere: false, agentName: null }],
    ["agentName", { isClaimed: true, isHere: false, record: null }],
    ["isClaimed", { isClaimed: "yes", isHere: false, record: null, agentName: null }],
    ["isHere", { isClaimed: true, isHere: 1, record: null, agentName: null }],
    ["record", { isClaimed: true, isHere: false, record: "page", agentName: null }],
    ["record.url", { isClaimed: true, isHere: false, record: { instance: "page", profileKey: "folder-1" }, agentName: null }],
    ["agentName", { isClaimed: true, isHere: false, record: null, agentName: 7 }],
    ["window", { isClaimed: true, isHere: false, record: null, agentName: null, window: 1 }]
  ])("refuses a wire form with a missing, wrong or unknown %s, at the field's path", (field, value) => {
    expect(() => PageClaim.fromJson(value)).toThrow(JsonException);
    expect(() => PageClaim.fromJson(value)).toThrow(`$.${field}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => PageClaim.fromJson([])).toThrow("$: ");
  });
});

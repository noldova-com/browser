/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { PageActivity } from "../../src/models/page-activity.ts";
import { PageBox } from "../../src/models/page-box.ts";
import { PagePoint } from "../../src/models/page-point.ts";
import { PageRefusal } from "../../src/models/page-refusal.ts";

const EVENT = {
  instance: "0f8fad5b-d9cb-469f-a165-70867728950e", activity: "5b1c2a7e-3d4f-4e8a-9b0c-1d2e3f4a5b6c", agentName: "Scout", action: "Clicking",
  state: "Acting", box: { x: 10, y: 20, width: 30, height: 0 }, point: { x: 25, y: 20 }, refusal: null, isHandedOver: false
};
const REFUSED = {
  ...EVENT, action: "Navigating", state: "Ended", box: null, point: null,
  refusal: { url: "https://docs.example.com/pricing", origin: "https://docs.example.com" }, isHandedOver: true
};

describe("PageActivity", () => {
  it("reads its wire form with a box and point, or with a refusal, and writes the same", () => {
    const activities: readonly PageActivity[] = [PageActivity.fromJson(EVENT), PageActivity.fromJson(REFUSED)];

    expect(activities.map(t => [
      t instanceof PageActivity, t.instance, t.activity, t.agentName, t.action, t.state, t.box instanceof PageBox, t.point instanceof PagePoint,
      t.refusal instanceof PageRefusal, t.isHandedOver, t.toJson()
    ])).toEqual([
      [true, EVENT.instance, EVENT.activity, "Scout", "Clicking", "Acting", true, true, false, false, EVENT],
      [true, EVENT.instance, EVENT.activity, "Scout", "Navigating", "Ended", false, false, true, true, REFUSED]
    ]);
  });

  it.each(["instance", "activity", "agentName", "action", "state", "box", "point", "refusal", "isHandedOver"])(
    "refuses a wire form without %s, at the field's path", field => {
      const value: Record<string, unknown> = Object.fromEntries(Object.entries(EVENT).filter(([name]) => name !== field));

      expect(() => PageActivity.fromJson(value)).toThrow(JsonException);
      expect(() => PageActivity.fromJson(value)).toThrow(`$.${field}: `);
    });

  it.each([
    ["instance", { ...EVENT, instance: 1 }],
    ["activity", { ...EVENT, activity: null }],
    ["agentName", { ...EVENT, agentName: false }],
    ["action", { ...EVENT, action: "Scrolling" }],
    ["state", { ...EVENT, state: "paused" }],
    ["box", { ...EVENT, box: [10, 20, 30, 0] }],
    ["box.width", { ...EVENT, box: { x: 10, y: 20, width: -1, height: 0 } }],
    ["box.height", { ...EVENT, box: { x: 10, y: 20, width: 30 } }],
    ["point", { ...EVENT, point: "25,20" }],
    ["point.y", { ...EVENT, point: { x: 25, y: null } }],
    ["refusal", { ...EVENT, refusal: 1 }],
    ["refusal.origin", { ...REFUSED, refusal: { url: "https://docs.example.com/", origin: "https://other.example.com" } }],
    ["isHandedOver", { ...EVENT, isHandedOver: "yes" }],
    ["window", { ...EVENT, window: 1 }]
  ])("refuses a wire form with a wrong or unknown %s, at the field's path", (field, value) => {
    expect(() => PageActivity.fromJson(value, "$.1")).toThrow(JsonException);
    expect(() => PageActivity.fromJson(value, "$.1")).toThrow(`$.1.${field}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => PageActivity.fromJson("Clicking")).toThrow("$: ");
  });
});

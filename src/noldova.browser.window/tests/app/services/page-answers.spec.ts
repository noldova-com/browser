/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { HeldPages, PageActivity, PageAgent, PageClaim, PageRecord, TypedAddressAllowed, TypedAddressRefused } from "@noldova/browser.protocol";
import { JsonException, type JsonObject, type JsonValue } from "@noldova/context.json";
import { describe, expect, it, vi } from "vitest";

import { AppNameAnswerMalformedException } from "../../../src/app/exceptions/app-name-answer-malformed.exception.ts";
import { HeldPagesAnswerMalformedException } from "../../../src/app/exceptions/held-pages-answer-malformed.exception.ts";
import { PageActivitiesAnswerMalformedException } from "../../../src/app/exceptions/page-activities-answer-malformed.exception.ts";
import { PageActivityEventMalformedException } from "../../../src/app/exceptions/page-activity-event-malformed.exception.ts";
import { PageClaimAnswerMalformedException } from "../../../src/app/exceptions/page-claim-answer-malformed.exception.ts";
import { PageRecordAnswerMalformedException } from "../../../src/app/exceptions/page-record-answer-malformed.exception.ts";
import { TypedAddressAnswerMalformedException } from "../../../src/app/exceptions/typed-address-answer-malformed.exception.ts";
import { PageAnswers } from "../../../src/app/services/page-answers.ts";

const INSTANCE: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
const EVENT: JsonObject = {
  instance: INSTANCE, activity: "5b1c2a7e-3d4f-4e8a-9b0c-1d2e3f4a5b6c", agentName: "Scout", action: "Clicking", state: "Acting",
  box: { x: 10, y: 20, width: 30, height: 0 }, point: { x: 25, y: 20 }, refusal: null, isHandedOver: false
};

function failureOf(read: () => unknown): unknown {
  try {
    read();
  }
  catch (error) {
    return error;
  }
  return undefined;
}

function factsOf(error: unknown): unknown {
  return error instanceof Error && "path" in error ? [error.name, error.path, error.cause instanceof JsonException] : error;
}

describe("PageAnswers", () => {
  it("reads a typed address's answer, allowed or refused, as its class", () => {
    const allowed = PageAnswers.readTypedAddress({ kind: "Allowed", origin: "https://example.com" });

    expect([allowed instanceof TypedAddressAllowed, allowed.toJson()]).toEqual([true, { kind: "Allowed", origin: "https://example.com" }]);
    for (const reason of ["NotAnAddress", "NotWeb", "TooLong", "Credentials", "Local", "NeverAllowed"] as const) {
      const refused = PageAnswers.readTypedAddress({ kind: "Refused", reason });
      expect([refused instanceof TypedAddressRefused, refused.toJson()]).toEqual([true, { kind: "Refused", reason }]);
    }
  });

  it.each<[JsonValue, string]>([
    [null, "$"],
    ["Allowed", "$"],
    [[], "$"],
    [{ kind: "Allowed" }, "$.origin"],
    [{ kind: "Refused", reason: "failed" }, "$.reason"],
    [{ kind: "maybe", origin: "https://example.com" }, "$.kind"]
  ])("fails a typed address's answer %j, at %s, with the JSON failure as its cause", (answer, path) => {
    expect(factsOf(failureOf(() => PageAnswers.readTypedAddress(answer)))).toEqual(["TypedAddressAnswerMalformedException", path, true]);
    expect(() => PageAnswers.readTypedAddress(answer)).toThrow(TypedAddressAnswerMalformedException);
  });

  it("reads a page's record, or null when the runtime part keeps none", () => {
    const record = { instance: INSTANCE, profileKey: "workspace-1", url: "" };
    const read: PageRecord | null = PageAnswers.readRecord(record);

    expect([read instanceof PageRecord, read?.toJson(), PageAnswers.readRecord(null)]).toEqual([true, record, null]);
  });

  it.each<[JsonValue, string]>([
    [1, "$"],
    [[], "$"],
    [{}, "$.instance"],
    [{ instance: "page", profileKey: "workspace-1" }, "$.url"],
    [{ instance: "page", profileKey: 1, url: "" }, "$.profileKey"],
    [{ instance: 1, profileKey: "workspace-1", url: "" }, "$.instance"]
  ])("fails a page's record %j, at %s", (answer, path) => {
    expect(factsOf(failureOf(() => PageAnswers.readRecord(answer)))).toEqual(["PageRecordAnswerMalformedException", path, true]);
    expect(() => PageAnswers.readRecord(answer)).toThrow(PageRecordAnswerMalformedException);
  });

  it("reads a page's claim, with its record and agent or neither", () => {
    const record = { instance: INSTANCE, profileKey: "workspace-1", url: "https://docs.example.com/" };
    const claims: readonly PageClaim[] = [
      PageAnswers.readClaim({ isClaimed: true, isHere: true, record, agentName: "Scout" }),
      PageAnswers.readClaim({ isClaimed: false, isHere: false, record: null, agentName: null })
    ];

    expect(claims.map(t => [t instanceof PageClaim, t.toJson()])).toEqual([
      [true, { isClaimed: true, isHere: true, record, agentName: "Scout" }],
      [true, { isClaimed: false, isHere: false, record: null, agentName: null }]
    ]);
  });

  it.each<[JsonValue, string]>([
    [null, "$"],
    [1, "$"],
    [{}, "$.isClaimed"],
    [{ isClaimed: "yes", isHere: false, record: null, agentName: null }, "$.isClaimed"],
    [{ isClaimed: true, isHere: 1, record: null, agentName: null }, "$.isHere"],
    [{ isClaimed: true, isHere: false, agentName: null }, "$.record"],
    [{ isClaimed: true, isHere: false, record: { instance: "page" }, agentName: null }, "$.record.profileKey"],
    [{ isClaimed: true, isHere: false, record: null }, "$.agentName"]
  ])("fails a page's claim %j, its record's fields included, at %s", (answer, path) => {
    expect(factsOf(failureOf(() => PageAnswers.readClaim(answer)))).toEqual(["PageClaimAnswerMalformedException", path, true]);
    expect(() => PageAnswers.readClaim(answer)).toThrow(PageClaimAnswerMalformedException);
  });

  it("reads the pages another window has and the agents on the held ones from the answer to the window's open pages", () => {
    const held: readonly HeldPages[] = [
      PageAnswers.readHeldPages({ refused: [], agents: [] }),
      PageAnswers.readHeldPages({ refused: [INSTANCE], agents: [{ instance: "5b1c2a7e-3d4f-4e8a-9b0c-1d2e3f4a5b6c", agentName: "Scout" }] })
    ];

    expect(held.map(t => [t instanceof HeldPages, t.agents.every(u => u instanceof PageAgent), t.toJson()])).toEqual([
      [true, true, { refused: [], agents: [] }],
      [true, true, { refused: [INSTANCE], agents: [{ instance: "5b1c2a7e-3d4f-4e8a-9b0c-1d2e3f4a5b6c", agentName: "Scout" }] }]
    ]);
  });

  it.each<[JsonValue, string]>([
    [null, "$"],
    [[], "$"],
    [{ agents: [] }, "$.refused"],
    [{ refused: "page", agents: [] }, "$.refused"],
    [{ refused: [1], agents: [] }, "$.refused.0"],
    [{ refused: [] }, "$.agents"],
    [{ refused: [], agents: [{ instance: INSTANCE }] }, "$.agents.0.agentName"]
  ])("fails the answer to the window's open pages %j, at %s", (answer, path) => {
    expect(factsOf(failureOf(() => PageAnswers.readHeldPages(answer)))).toEqual(["HeldPagesAnswerMalformedException", path, true]);
    expect(() => PageAnswers.readHeldPages(answer)).toThrow(HeldPagesAnswerMalformedException);
  });

  it("reads an activity event, a navigation's refusal and a hand-over included", () => {
    const refused: JsonObject = { ...EVENT, action: "Navigating", state: "Ended", box: null, point: null,
      refusal: { url: "https://docs.example.com/pricing", origin: "https://docs.example.com" } };
    const takenOver: JsonObject = { ...EVENT, action: "Typing", state: "Ended", isHandedOver: true };

    expect([EVENT, refused, takenOver].map(t => PageAnswers.readActivity(t)).map(t => [t instanceof PageActivity, t.toJson()]))
      .toEqual([[true, EVENT], [true, refused], [true, takenOver]]);
  });

  it.each<[JsonValue, string]>([
    ["Clicking", "$"],
    [{ ...EVENT, state: "paused" }, "$.state"],
    [{ ...EVENT, box: { x: 10, y: 20, width: -1, height: 40 } }, "$.box.width"],
    [{ ...EVENT, point: { x: 25, y: null } }, "$.point.y"],
    [{ ...EVENT, refusal: { url: "https://docs.example.com/", origin: "https://other.example.com" } }, "$.refusal.origin"],
    [{ ...EVENT, isHandedOver: "yes" }, "$.isHandedOver"]
  ])("fails an activity event %j, at %s", (payload, path) => {
    expect(factsOf(failureOf(() => PageAnswers.readActivity(payload)))).toEqual(["PageActivityEventMalformedException", path, true]);
    expect(() => PageAnswers.readActivity(payload)).toThrow(PageActivityEventMalformedException);
  });

  it("reads every activity of the runtime part's answer, in its order, and none from an empty answer", () => {
    const asking: JsonObject = { ...EVENT, activity: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", state: "Asking" };

    expect([PageAnswers.readActivities([EVENT, asking]).map(t => t.toJson()), PageAnswers.readActivities([])]).toEqual([[EVENT, asking], []]);
  });

  it("fails an answer of activities that isn't an array at its root, and one of its activities at the activity's own path", () => {
    const notArray: unknown = failureOf(() => PageAnswers.readActivities({ activities: [EVENT] }));

    expect([notArray instanceof PageActivitiesAnswerMalformedException, factsOf(notArray)]).toEqual([true, ["PageActivitiesAnswerMalformedException", "$", false]]);
    expect(factsOf(failureOf(() => PageAnswers.readActivities([EVENT, { ...EVENT, state: "paused" }]))))
      .toEqual(["PageActivitiesAnswerMalformedException", "$.1.state", true]);
  });

  it("reads the app's name, and fails one that isn't a name at the root", () => {
    expect(PageAnswers.readAppName("Example")).toBe("Example");
    for (const answer of [null, 1, [], "", "  "]) {
      expect(() => PageAnswers.readAppName(answer), JSON.stringify(answer)).toThrow(AppNameAnswerMalformedException);
      expect(factsOf(failureOf(() => PageAnswers.readAppName(answer)))).toEqual(["AppNameAnswerMalformedException", "$", false]);
    }
  });

  it("passes on a failure of the reading that isn't a JSON one", () => {
    const error: Error = new Error("Broken reader.");
    const reading = vi.spyOn(PageClaim, "fromJson").mockImplementation(() => {
      throw error;
    });

    try {
      expect(() => PageAnswers.readClaim({})).toThrow(error);
    }
    finally {
      reading.mockRestore();
    }
  });
});

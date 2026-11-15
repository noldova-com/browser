/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { PageAgent } from "../../src/models/page-agent.ts";

const INSTANCE: string = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("PageAgent", () => {
  it("reads its wire form and writes the same", () => {
    const agent: PageAgent = PageAgent.fromJson({ instance: INSTANCE, agentName: "Scout" });

    expect([agent, agent.instance, agent.agentName, agent.toJson()]).toEqual([expect.any(PageAgent), INSTANCE, "Scout", { instance: INSTANCE, agentName: "Scout" }]);
  });

  it.each([
    ["instance", { agentName: "Scout" }],
    ["agentName", { instance: INSTANCE }],
    ["instance", { instance: 1, agentName: "Scout" }],
    ["agentName", { instance: INSTANCE, agentName: null }],
    ["session", { instance: INSTANCE, agentName: "Scout", session: "a" }]
  ])("refuses a wire form with a missing, wrong or unknown %s, at the field's path", (field, value) => {
    expect(() => PageAgent.fromJson(value, "$.agents.0")).toThrow(JsonException);
    expect(() => PageAgent.fromJson(value, "$.agents.0")).toThrow(`$.agents.0.${field}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => PageAgent.fromJson("Scout")).toThrow("$: ");
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { HeldPages } from "../../src/models/held-pages.ts";
import { PageAgent } from "../../src/models/page-agent.ts";

const INSTANCE: string = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("HeldPages", () => {
  it("reads its wire form, empty or not, and writes the same", () => {
    const held: readonly HeldPages[] = [
      HeldPages.fromJson({ refused: [], agents: [] }),
      HeldPages.fromJson({ refused: [INSTANCE], agents: [{ instance: INSTANCE, agentName: "Scout" }] })
    ];

    expect(held.map(t => [t instanceof HeldPages, t.refused, t.agents.map(u => u instanceof PageAgent), t.toJson()])).toEqual([
      [true, [], [], { refused: [], agents: [] }],
      [true, [INSTANCE], [true], { refused: [INSTANCE], agents: [{ instance: INSTANCE, agentName: "Scout" }] }]
    ]);
  });

  it.each([
    ["$.refused", { agents: [] }],
    ["$.agents", { refused: [] }],
    ["$.refused", { refused: "page", agents: [] }],
    ["$.refused.1", { refused: ["page", 1], agents: [] }],
    ["$.agents", { refused: [], agents: {} }],
    ["$.agents.0", { refused: [], agents: ["Scout"] }],
    ["$.agents.0.agentName", { refused: [], agents: [{ instance: INSTANCE }] }],
    ["$.held", { refused: [], agents: [], held: [] }]
  ])("refuses a wire form with a missing, wrong or unknown field, at %s", (path, value) => {
    expect(() => HeldPages.fromJson(value)).toThrow(JsonException);
    expect(() => HeldPages.fromJson(value)).toThrow(`${path}: `);
  });

  it("refuses a value that isn't an object, at the root", () => {
    expect(() => HeldPages.fromJson(null)).toThrow("$: ");
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { NodeFacts } from "../../src/models/node-facts.ts";

describe("NodeFacts", () => {
  it("keeps its fields", () => {
    const facts: NodeFacts = new NodeFacts("INPUT", new Map([["type", "password"]]));

    expect([facts.nodeName, facts.attributes]).toEqual(["INPUT", new Map([["type", "password"]])]);
  });
});

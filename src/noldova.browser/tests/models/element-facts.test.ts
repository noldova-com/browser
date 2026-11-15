/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ElementFacts } from "../../src/models/element-facts.ts";
import { NodeFacts } from "../../src/models/node-facts.ts";
import { PageFacts } from "../../src/models/page-facts.ts";

describe("ElementFacts", () => {
  it("keeps its fields", () => {
    const button: NodeFacts = new NodeFacts("BUTTON", new Map([["type", "submit"]]));
    const facts: ElementFacts = new ElementFacts([button], [button], new PageFacts("https://shop.test/cart"));

    expect([facts.path, facts.form, facts.page.baseUrl]).toEqual([[button], [button], "https://shop.test/cart"]);
  });
});

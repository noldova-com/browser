/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PageFacts } from "../../src/models/page-facts.ts";

describe("PageFacts", () => {
  it("keeps its fields", () => {
    const pageFacts: PageFacts = new PageFacts("https://shop.test/cart");

    expect([pageFacts.baseUrl]).toEqual(["https://shop.test/cart"]);
  });
});

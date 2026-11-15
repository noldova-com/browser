/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { FrameFacts } from "../../src/models/frame-facts.ts";

describe("FrameFacts", () => {
  it("keeps its fields", () => {
    const frameFacts: FrameFacts = new FrameFacts("https://shop.test/cart", "https://shop.test", "L1");

    expect([frameFacts.url, frameFacts.origin, frameFacts.documentId]).toEqual(["https://shop.test/cart", "https://shop.test", "L1"]);
  });
});

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
    const frameFacts: FrameFacts = new FrameFacts("https://shop.test/cart", "https://shop.test", "L1", "F1", null);

    expect([frameFacts.url, frameFacts.origin, frameFacts.documentId, frameFacts.address]).toEqual(["https://shop.test/cart", "https://shop.test", "L1", "https://shop.test/cart"]);
  });

  it("is at the address that failed to load while it shows the engine's error page", () => {
    const frameFacts: FrameFacts = new FrameFacts("chrome-error://chromewebdata/", "browser:opaque", "L1", "F1", "https://shop.test/cart");

    expect([frameFacts.url, frameFacts.address]).toEqual(["chrome-error://chromewebdata/", "https://shop.test/cart"]);
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ShownPage } from "../../src/models/shown-page.ts";

describe("ShownPage", () => {
  it("keeps its fields", () => {
    const shownPage: ShownPage = new ShownPage("https://shop.test/cart", "Cart");

    expect([shownPage.url, shownPage.title]).toEqual(["https://shop.test/cart", "Cart"]);
  });
});

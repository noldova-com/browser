/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { HistoryTarget } from "../../src/models/history-target.ts";

describe("HistoryTarget", () => {
  it("keeps its fields", () => {
    const historyTarget: HistoryTarget = new HistoryTarget(2, "https://shop.test/cart");

    expect([historyTarget.index, historyTarget.url]).toEqual([2, "https://shop.test/cart"]);
  });
});

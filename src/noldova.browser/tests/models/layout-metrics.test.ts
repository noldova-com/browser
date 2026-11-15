/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { LayoutMetrics } from "../../src/models/layout-metrics.ts";

describe("LayoutMetrics", () => {
  it("keeps its fields", () => {
    const layoutMetrics: LayoutMetrics = new LayoutMetrics(0, 40, 800, 600, 1_200, 3_000, 2);

    expect([layoutMetrics.pageX, layoutMetrics.pageY, layoutMetrics.width, layoutMetrics.height, layoutMetrics.contentWidth, layoutMetrics.contentHeight, layoutMetrics.deviceScale]).toEqual([0, 40, 800, 600, 1_200, 3_000, 2]);
  });
});

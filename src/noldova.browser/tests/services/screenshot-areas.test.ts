/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageBox } from "@noldova/browser.protocol";
import { describe, expect, it } from "vitest";

import { LayoutMetrics } from "../../src/models/layout-metrics.ts";
import { ScreenshotArea } from "../../src/models/screenshot-area.ts";
import { ScreenshotAreas } from "../../src/services/screenshot-areas.ts";

const METRICS: LayoutMetrics = new LayoutMetrics(0, 300, 800, 600, 800, 2400, 1);

describe("ScreenshotAreas", () => {
  it("captures the visible viewport where it is in the document, unscaled when it is within the limit", () => {
    expect(ScreenshotAreas.plan(METRICS, null, false)).toStrictEqual(new ScreenshotArea(0, 300, 800, 600, 1, 800, 600, false));
  });

  it("scales the full page so its longer side in device pixels is 1,600", () => {
    expect(ScreenshotAreas.plan(METRICS, null, true)).toStrictEqual(new ScreenshotArea(0, 0, 800, 2400, 1600 / 2400, 533, 1600, false));
  });

  it("counts the device pixels of each CSS pixel, so a 2x display's viewport scales by half", () => {
    const area: ScreenshotArea = ScreenshotAreas.plan(new LayoutMetrics(0, 300, 1200, 800, 800, 2400, 2), null, false);

    expect([area.scale, area.imageWidth, area.imageHeight]).toEqual([1600 / 2400, 1600, 1067]);
  });

  it("captures an element's box, which is in the viewport, at its place in the document", () => {
    expect(ScreenshotAreas.plan(METRICS, new PageBox(10, 20, 100, 40), false))
      .toStrictEqual(new ScreenshotArea(10, 320, 100, 40, 1, 100, 40, false));
  });

  it("cuts a side longer than the engine's clip takes, and says so", () => {
    const area: ScreenshotArea = ScreenshotAreas.plan(new LayoutMetrics(0, 300, 800, 600, 5000, 9000, 1), null, true);

    expect([area.width, area.height, area.isCut, area.imageWidth, area.imageHeight]).toEqual([4096, 4096, true, 1600, 1600]);
    expect(ScreenshotAreas.plan(new LayoutMetrics(0, 300, 800, 600, 800, 9000, 1), null, true).isCut).toBe(true);
  });

  it("gives an empty image for an area with no size", () => {
    const area: ScreenshotArea = ScreenshotAreas.plan(METRICS, new PageBox(10, 20, 0, 40), false);

    expect([area.imageWidth, area.imageHeight]).toEqual([0, 40]);
  });
});

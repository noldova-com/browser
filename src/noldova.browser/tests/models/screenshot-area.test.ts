/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ScreenshotArea } from "../../src/models/screenshot-area.ts";

describe("ScreenshotArea", () => {
  it("keeps its fields", () => {
    const screenshotArea: ScreenshotArea = new ScreenshotArea(10, 20, 800, 600, 0.5, 800, 600, false);

    expect([screenshotArea.x, screenshotArea.y, screenshotArea.width, screenshotArea.height, screenshotArea.scale, screenshotArea.imageWidth, screenshotArea.imageHeight, screenshotArea.isCut]).toEqual([10, 20, 800, 600, 0.5, 800, 600, false]);
  });
});

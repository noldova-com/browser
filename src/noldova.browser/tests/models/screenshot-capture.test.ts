/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ScreenshotArea } from "../../src/models/screenshot-area.ts";
import { ScreenshotCapture } from "../../src/models/screenshot-capture.ts";

describe("ScreenshotCapture", () => {
  it("keeps its fields", () => {
    const area: ScreenshotArea = new ScreenshotArea(0, 0, 800, 600, 1, 800, 600, false);
    const capture: ScreenshotCapture = new ScreenshotCapture(area, "iVBORw0KGgo=", "image/png", true);

    expect([capture.area, capture.data, capture.mimeType, capture.isLaidOut]).toEqual([area, "iVBORw0KGgo=", "image/png", true]);
  });
});

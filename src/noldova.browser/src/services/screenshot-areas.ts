/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageBox } from "@noldova/browser.protocol";

import { BrowserLimits } from "../models/browser-limits.ts";
import type { LayoutMetrics } from "../models/layout-metrics.ts";
import { ScreenshotArea } from "../models/screenshot-area.ts";
import { Resources } from "../resources.ts";

export class ScreenshotAreas {
  public static plan(metrics: LayoutMetrics, box: PageBox | null, isFullPage: boolean): ScreenshotArea {
    const area: PageBox = box !== null
      ? new PageBox(box.x + metrics.pageX, box.y + metrics.pageY, box.width, box.height)
      : isFullPage
        ? new PageBox(0, 0, metrics.contentWidth, metrics.contentHeight)
        : new PageBox(metrics.pageX, metrics.pageY, metrics.width, metrics.height);
    const width: number = Math.min(area.width, Resources.maximumClipLength);
    const height: number = Math.min(area.height, Resources.maximumClipLength);
    const scale: number = Math.min(1, BrowserLimits.maximumScreenshotSide / (Math.max(width, height) * metrics.deviceScale));
    return new ScreenshotArea(
      area.x,
      area.y,
      width,
      height,
      scale,
      Math.round(width * scale * metrics.deviceScale),
      Math.round(height * scale * metrics.deviceScale),
      width < area.width || height < area.height
    );
  }
}

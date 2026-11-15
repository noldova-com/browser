/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {} from "@vitest/browser-playwright";
import { cdp } from "vitest/browser";

export class ZoomFixture {
  private static readonly RATIO: number = devicePixelRatio;

  public static zoomAsync(factor: number): Promise<unknown> {
    return ZoomFixture.sendAsync(ZoomFixture.RATIO * factor);
  }

  public static resetAsync(): Promise<unknown> {
    return ZoomFixture.sendAsync(ZoomFixture.RATIO);
  }

  private static sendAsync(ratio: number): Promise<unknown> {
    const outer: Window = window.top ?? window;
    return cdp().send("Emulation.setDeviceMetricsOverride", { width: outer.innerWidth, height: outer.innerHeight, deviceScaleFactor: ratio, mobile: false });
  }
}

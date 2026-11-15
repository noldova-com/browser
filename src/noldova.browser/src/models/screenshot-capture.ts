/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ScreenshotArea } from "./screenshot-area.ts";

export class ScreenshotCapture {
  public readonly area: ScreenshotArea;
  public readonly data: string;
  public readonly mimeType: string;
  public readonly isLaidOut: boolean;

  public constructor(area: ScreenshotArea, data: string, mimeType: string, isLaidOut: boolean) {
    this.area = area;
    this.data = data;
    this.mimeType = mimeType;
    this.isLaidOut = isLaidOut;
  }
}

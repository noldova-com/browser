/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ScreenshotEncoding {
  public readonly format: "png" | "jpeg";
  public readonly quality: number | null;

  public constructor(format: "png" | "jpeg", quality: number | null) {
    this.format = format;
    this.quality = quality;
  }
}

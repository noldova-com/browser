/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class LayoutMetrics {
  public readonly pageX: number;
  public readonly pageY: number;
  public readonly width: number;
  public readonly height: number;
  public readonly contentWidth: number;
  public readonly contentHeight: number;
  public readonly deviceScale: number;

  public constructor(pageX: number, pageY: number, width: number, height: number, contentWidth: number, contentHeight: number, deviceScale: number) {
    this.pageX = pageX;
    this.pageY = pageY;
    this.width = width;
    this.height = height;
    this.contentWidth = contentWidth;
    this.contentHeight = contentHeight;
    this.deviceScale = deviceScale;
  }
}

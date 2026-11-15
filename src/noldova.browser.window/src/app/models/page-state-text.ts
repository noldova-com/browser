/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PageStateText {
  public readonly glyph: string;
  public readonly heading: string;
  public readonly detail: string | null;

  public constructor(glyph: string, heading: string, detail: string | null) {
    this.glyph = glyph;
    this.heading = heading;
    this.detail = detail;
  }
}

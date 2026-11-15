/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class RequestNotice {
  public readonly glyph: string;
  public readonly message: string;
  public readonly action: string | null;

  public constructor(glyph: string, message: string, action: string | null) {
    this.glyph = glyph;
    this.message = message;
    this.action = action;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CutText {
  public readonly text: string;
  public readonly isCut: boolean;

  public constructor(text: string, isCut: boolean) {
    this.text = text;
    this.isCut = isCut;
  }
}

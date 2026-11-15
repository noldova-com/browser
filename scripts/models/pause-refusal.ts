/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PauseRefusal {
  public readonly index: number;
  public readonly form: string;

  public constructor(index: number, form: string) {
    this.index = index;
    this.form = form;
  }

  public lineIn(text: string, lineFeed: string): number {
    return text.slice(0, this.index).split(lineFeed).length;
  }
}

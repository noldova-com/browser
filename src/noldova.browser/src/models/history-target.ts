/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class HistoryTarget {
  public readonly index: number | null;
  public readonly url: string;

  public constructor(index: number | null, url: string) {
    this.index = index;
    this.url = url;
  }
}

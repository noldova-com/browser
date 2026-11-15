/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ConsoleEntry } from "./console-entry.ts";

export class ConsoleRead {
  public readonly entries: readonly ConsoleEntry[];
  public readonly oldest: number;
  public readonly next: number;
  public readonly mayRepeat: boolean;

  public constructor(entries: readonly ConsoleEntry[], oldest: number, next: number, mayRepeat: boolean) {
    this.entries = entries;
    this.oldest = oldest;
    this.next = next;
    this.mayRepeat = mayRepeat;
  }
}

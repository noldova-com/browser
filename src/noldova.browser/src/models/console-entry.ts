/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ConsoleLevel } from "../enums/console-level.ts";

export class ConsoleEntry {
  public readonly sequence: number;
  public readonly level: ConsoleLevel | null;
  public readonly source: string;
  public readonly text: string;
  public readonly time: number;
  public readonly origin: string;

  public constructor(sequence: number, level: ConsoleLevel | null, source: string, text: string, time: number, origin: string) {
    this.sequence = sequence;
    this.level = level;
    this.source = source;
    this.text = text;
    this.time = time;
    this.origin = origin;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ConsoleLevel } from "../enums/console-level.ts";
import { ConsoleEvent } from "./console-event.ts";
import type { ConsoleRing } from "./console-ring.ts";

export class ConsoleEntryEvent extends ConsoleEvent {
  public readonly level: ConsoleLevel;
  public readonly source: string;
  public readonly text: string;
  public readonly time: number;

  public constructor(level: ConsoleLevel, source: string, text: string, time: number) {
    super();
    this.level = level;
    this.source = source;
    this.text = text;
    this.time = time;
  }

  public addTo(ring: ConsoleRing): void {
    ring.add(this.level, ConsoleEvent.cut(this.source), ConsoleEvent.cut(this.text), this.time);
  }
}

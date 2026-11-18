/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SnapshotLine } from "./snapshot-line.ts";

// The lines read from the accessibility tree inside a closed shadow root's host, and whether they were cut at the most bytes or the time
// left, or left out below the most depth.
export class ClosedRead {
  public readonly lines: readonly SnapshotLine[];
  public readonly isCut: boolean;
  public readonly isDeeper: boolean;

  public constructor(lines: readonly SnapshotLine[], isCut: boolean, isDeeper: boolean) {
    this.lines = lines;
    this.isCut = isCut;
    this.isDeeper = isDeeper;
  }
}

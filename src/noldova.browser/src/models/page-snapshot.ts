/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SnapshotLine } from "./snapshot-line.ts";

// The page's snapshot as the pinned function gives it: the title, the lines, and whether they were cut at the most bytes, left out below the
// most depth or start where the page is scrolled to, how many closed shadow roots the snapshot couldn't read within its limit or time,
// which show only their host's line, and the elements too large to search for them.
export class PageSnapshot {
  public readonly title: string;
  public readonly lines: readonly SnapshotLine[];
  public readonly isCut: boolean;
  public readonly isDeeper: boolean;
  public readonly isFromView: boolean;
  public readonly unread: number;
  public readonly unsearched: readonly string[];

  public constructor(title: string, lines: readonly SnapshotLine[], isCut: boolean, isDeeper: boolean, isFromView: boolean, unread: number = 0,
    unsearched: readonly string[] = []) {
    this.title = title;
    this.lines = lines;
    this.isCut = isCut;
    this.isDeeper = isDeeper;
    this.isFromView = isFromView;
    this.unread = unread;
    this.unsearched = unsearched;
  }
}

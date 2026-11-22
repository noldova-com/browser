/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FrameFacts } from "./frame-facts.ts";
import type { PageSnapshot } from "./page-snapshot.ts";

// A snapshot of the page's lines, with the main frame that showed the document they come from.
export class SnapshotRead {
  public readonly frame: FrameFacts;
  public readonly snapshot: PageSnapshot;

  public constructor(frame: FrameFacts, snapshot: PageSnapshot) {
    this.frame = frame;
    this.snapshot = snapshot;
  }
}

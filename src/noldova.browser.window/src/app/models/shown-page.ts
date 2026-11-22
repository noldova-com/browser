/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PagePlace } from "./page-place.ts";
import type { PaneTab } from "./pane-tab.ts";

export class ShownPage {
  public readonly tab: PaneTab;
  public readonly place: PagePlace;
  public readonly stop: () => void;

  public constructor(tab: PaneTab, place: PagePlace, stop: () => void) {
    this.tab = tab;
    this.place = place;
    this.stop = stop;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PagePlace } from "../types/page-place.ts";

export class OpeningPage {
  private taken: boolean = false;

  public readonly place: PagePlace;

  public constructor(place: PagePlace) {
    this.place = place;
  }

  public get isTaken(): boolean {
    return this.taken;
  }

  public take(): void {
    this.taken = true;
  }
}

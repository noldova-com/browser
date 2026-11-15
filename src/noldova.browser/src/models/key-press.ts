/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { KeyEvent } from "../types/key-event.ts";

export class KeyPress {
  public readonly down: KeyEvent;
  public readonly up: KeyEvent;

  public constructor(down: KeyEvent, up: KeyEvent) {
    this.down = down;
    this.up = up;
  }
}

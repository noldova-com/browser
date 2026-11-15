/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PaneState } from "../enums/pane-state.ts";

export class PaneStates {
  public static readonly all: readonly PaneState[] = Object.values(PaneState);

  public static includes(value: string): value is PaneState {
    return PaneStates.all.some(t => t === value);
  }
}

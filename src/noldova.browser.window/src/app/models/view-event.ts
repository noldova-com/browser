/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ViewEventKind } from "../enums/view-event-kind.ts";
import type { PaneHearing } from "../services/pane-hearing.ts";
import type { PaneStatus } from "./pane-status.ts";

export abstract class ViewEvent {
  public abstract readonly kind: ViewEventKind;

  public abstract applyTo(status: PaneStatus): PaneStatus;

  public abstract followIn(hearing: PaneHearing): void;
}

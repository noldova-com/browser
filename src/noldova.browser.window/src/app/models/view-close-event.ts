/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ViewEventKind } from "../enums/view-event-kind.ts";
import type { PaneHearing } from "../services/pane-hearing.ts";
import { PaneStatus } from "./pane-status.ts";
import { ViewEvent } from "./view-event.ts";

export class ViewCloseEvent extends ViewEvent {
  public readonly kind: typeof ViewEventKind.Closed;

  public constructor() {
    super();
    this.kind = ViewEventKind.Closed;
  }

  public applyTo(): PaneStatus {
    return PaneStatus.unavailable;
  }

  public followIn(hearing: PaneHearing): void {
    hearing.change(this);
  }
}

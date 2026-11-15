/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ViewEventKind } from "../enums/view-event-kind.ts";
import type { PaneHearing } from "../services/pane-hearing.ts";
import type { PaneStatus } from "./pane-status.ts";
import { ViewEvent } from "./view-event.ts";

export class ViewCrashEvent extends ViewEvent {
  public readonly kind: typeof ViewEventKind.Crashed;

  public constructor() {
    super();
    this.kind = ViewEventKind.Crashed;
  }

  public applyTo(status: PaneStatus): PaneStatus {
    return status.crash();
  }

  public followIn(hearing: PaneHearing): void {
    hearing.change(this);
  }
}

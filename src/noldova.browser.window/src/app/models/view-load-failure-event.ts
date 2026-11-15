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

export class ViewLoadFailureEvent extends ViewEvent {
  public readonly kind: typeof ViewEventKind.LoadFailed;
  public readonly address: string;
  public readonly code: number;
  public readonly description: string;

  public constructor(address: string, code: number, description: string) {
    super();
    this.kind = ViewEventKind.LoadFailed;
    this.address = address;
    this.code = code;
    this.description = description;
  }

  public applyTo(status: PaneStatus): PaneStatus {
    return status.fail(this);
  }

  public followIn(hearing: PaneHearing): void {
    hearing.fail(this);
  }
}

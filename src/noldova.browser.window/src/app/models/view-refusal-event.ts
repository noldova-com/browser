/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PaneState } from "../enums/pane-state.ts";
import { ViewEventKind } from "../enums/view-event-kind.ts";
import type { PaneHearing } from "../services/pane-hearing.ts";
import type { PaneStatus } from "./pane-status.ts";
import { ViewEvent } from "./view-event.ts";

export class ViewRefusalEvent extends ViewEvent {
  public readonly kind: typeof ViewEventKind.NavigationRefused;
  public readonly address: string;
  public readonly origin: string;
  public readonly isRedirect: boolean;

  public constructor(address: string, origin: string, isRedirect: boolean) {
    super();
    this.kind = ViewEventKind.NavigationRefused;
    this.address = address;
    this.origin = origin;
    this.isRedirect = isRedirect;
  }

  public applyTo(status: PaneStatus): PaneStatus {
    const isBeforeItsLoad: boolean = status.state !== PaneState.Loading;
    return status.refuse(this.origin, isBeforeItsLoad);
  }

  public followIn(hearing: PaneHearing): void {
    hearing.refuse(this);
  }
}

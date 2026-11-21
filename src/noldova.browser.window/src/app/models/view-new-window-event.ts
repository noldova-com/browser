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

export class ViewNewWindowEvent extends ViewEvent {
  public readonly kind: typeof ViewEventKind.NewWindowRequested;
  public readonly address: string;
  public readonly hadRecentInput: boolean;
  public readonly origin: string | null;
  public readonly isBackgroundTab: boolean;
  public readonly isFromPress: boolean;

  public constructor(address: string, hadRecentInput: boolean, origin: string | null, isBackgroundTab: boolean = false, isFromPress: boolean = false) {
    super();
    this.kind = ViewEventKind.NewWindowRequested;
    this.address = address;
    this.hadRecentInput = hadRecentInput;
    this.origin = origin;
    this.isBackgroundTab = isBackgroundTab;
    this.isFromPress = isFromPress;
  }

  public applyTo(status: PaneStatus): PaneStatus {
    return status;
  }

  public followIn(hearing: PaneHearing): void {
    hearing.openWindow(this);
  }
}

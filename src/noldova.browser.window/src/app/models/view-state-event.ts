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

export class ViewStateEvent extends ViewEvent {
  public readonly kind: typeof ViewEventKind.State;
  public readonly address: string;
  public readonly title: string;
  public readonly isLoading: boolean;
  public readonly canGoBack: boolean;
  public readonly canGoForward: boolean;

  public constructor(address: string, title: string, isLoading: boolean, canGoBack: boolean, canGoForward: boolean) {
    super();
    this.kind = ViewEventKind.State;
    this.address = address;
    this.title = title;
    this.isLoading = isLoading;
    this.canGoBack = canGoBack;
    this.canGoForward = canGoForward;
  }

  public applyTo(status: PaneStatus): PaneStatus {
    return status.show(this);
  }

  public followIn(hearing: PaneHearing): void {
    hearing.show(this);
  }
}

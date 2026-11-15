/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { RefusedRequest } from "../enums/refused-request.ts";
import { ViewEventKind } from "../enums/view-event-kind.ts";
import type { PaneHearing } from "../services/pane-hearing.ts";
import type { PaneStatus } from "./pane-status.ts";
import { ViewEvent } from "./view-event.ts";

export class ViewRequestRefusalEvent extends ViewEvent {
  public readonly kind: typeof ViewEventKind.RequestRefused;
  public readonly request: RefusedRequest;
  public readonly origin: string;

  public constructor(request: RefusedRequest, origin: string) {
    super();
    this.kind = ViewEventKind.RequestRefused;
    this.request = request;
    this.origin = origin;
  }

  public applyTo(status: PaneStatus): PaneStatus {
    return status.refuseRequest(this.request);
  }

  public followIn(hearing: PaneHearing): void {
    hearing.change(this);
  }
}

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

export class ViewFaviconEvent extends ViewEvent {
  public readonly kind: typeof ViewEventKind.Favicon;
  public readonly image: string | null;

  public constructor(image: string | null) {
    super();
    this.kind = ViewEventKind.Favicon;
    this.image = image;
  }

  public applyTo(status: PaneStatus): PaneStatus {
    return status;
  }

  public followIn(hearing: PaneHearing): void {
    hearing.showFavicon(this.image);
  }
}

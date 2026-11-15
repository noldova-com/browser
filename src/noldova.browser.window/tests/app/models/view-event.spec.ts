/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ViewEventKind } from "../../../src/app/enums/view-event-kind.ts";
import { PaneStatus } from "../../../src/app/models/pane-status.ts";
import { ViewEvent } from "../../../src/app/models/view-event.ts";
import { PaneHearing } from "../../../src/app/services/pane-hearing.ts";

describe("ViewEvent", () => {
  it("is the base of each kind's event, which names its kind, gives the status after it and tells the hearing of it", () => {
    class KeyEvent extends ViewEvent {
      public readonly kind: ViewEventKind = ViewEventKind.Key;

      public applyTo(status: PaneStatus): PaneStatus {
        return status;
      }

      public followIn(hearing: PaneHearing): void {
        hearing.change(this);
      }
    }

    const event: KeyEvent = new KeyEvent();
    const changes: ViewEvent[] = [];

    event.followIn(new PaneHearing(t => changes.push(t)));

    expect([event instanceof ViewEvent, event.kind, event.applyTo(PaneStatus.empty), changes]).toStrictEqual([true, ViewEventKind.Key, PaneStatus.empty, [event]]);
  });
});

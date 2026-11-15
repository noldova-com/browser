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
import { ViewCloseEvent } from "../../../src/app/models/view-close-event.ts";
import { ViewEvent } from "../../../src/app/models/view-event.ts";
import { PaneHearing } from "../../../src/app/services/pane-hearing.ts";

describe("ViewCloseEvent", () => {
  it("is a closed view's event, as a view event of its kind", () => {
    const event: ViewCloseEvent = new ViewCloseEvent();

    expect(event).toBeInstanceOf(ViewEvent);
    expect([event.kind]).toEqual([ViewEventKind.Closed]);
  });

  it("makes the pane unavailable, and has the hearing change the status by it", () => {
    const event: ViewCloseEvent = new ViewCloseEvent();
    const changes: ViewEvent[] = [];
    const hearing: PaneHearing = new PaneHearing(t => changes.push(t));

    event.followIn(hearing);

    expect(event.applyTo()).toBe(PaneStatus.unavailable);
    expect(changes).toStrictEqual([event]);
  });
});

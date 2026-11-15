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
import { ViewZoomEvent } from "../../../src/app/models/view-zoom-event.ts";
import { PaneHearing } from "../../../src/app/services/pane-hearing.ts";

describe("ViewZoomEvent", () => {
  it("keeps the view's zoom factor, as a view event of its kind", () => {
    const event: ViewZoomEvent = new ViewZoomEvent(1.25);

    expect(event).toBeInstanceOf(ViewEvent);
    expect([event.kind, event.factor]).toEqual([ViewEventKind.Zoom, 1.25]);
  });

  it("changes nothing shown, and gives the hearing the view's new zoom", () => {
    const event: ViewZoomEvent = new ViewZoomEvent(1.25);
    const changes: ViewEvent[] = [];
    const hearing: PaneHearing = new PaneHearing(t => changes.push(t));
    const factors: number[] = [];
    hearing.onZoom(t => factors.push(t));

    event.followIn(hearing);

    expect(event.applyTo(PaneStatus.empty)).toBe(PaneStatus.empty);
    expect([hearing.zoom, factors, changes]).toStrictEqual([1.25, [1.25], []]);
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PaneState } from "../../../src/app/enums/pane-state.ts";
import { ViewEventKind } from "../../../src/app/enums/view-event-kind.ts";
import { PaneStatus } from "../../../src/app/models/pane-status.ts";
import { ViewCrashEvent } from "../../../src/app/models/view-crash-event.ts";
import { ViewEvent } from "../../../src/app/models/view-event.ts";
import { PaneHearing } from "../../../src/app/services/pane-hearing.ts";

describe("ViewCrashEvent", () => {
  it("is a crashed page's event, as a view event of its kind", () => {
    const event: ViewCrashEvent = new ViewCrashEvent();

    expect(event).toBeInstanceOf(ViewEvent);
    expect([event.kind]).toEqual([ViewEventKind.Crashed]);
  });

  it("crashes the pane's page, and has the hearing change the status by it", () => {
    const event: ViewCrashEvent = new ViewCrashEvent();
    const changes: ViewEvent[] = [];
    const hearing: PaneHearing = new PaneHearing(t => changes.push(t));

    event.followIn(hearing);

    expect(event.applyTo(PaneStatus.empty).state).toBe(PaneState.Crashed);
    expect(changes).toStrictEqual([event]);
  });
});

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
import { ViewEvent } from "../../../src/app/models/view-event.ts";
import { ViewLoadFailureEvent } from "../../../src/app/models/view-load-failure-event.ts";
import { PaneHearing } from "../../../src/app/services/pane-hearing.ts";

describe("ViewLoadFailureEvent", () => {
  it("keeps the failed address, the engine's code and its description, as a view event of its kind", () => {
    const event: ViewLoadFailureEvent = new ViewLoadFailureEvent("https://gone.example/", -105, "ERR_NAME_NOT_RESOLVED");

    expect(event).toBeInstanceOf(ViewEvent);
    expect([event.kind, event.address, event.code, event.description]).toEqual([ViewEventKind.LoadFailed, "https://gone.example/", -105, "ERR_NAME_NOT_RESOLVED"]);
  });

  it("fails the pane's load with its address and description, and has the hearing change the status by it", () => {
    const event: ViewLoadFailureEvent = new ViewLoadFailureEvent("https://gone.example/", -105, "ERR_NAME_NOT_RESOLVED");
    const changes: ViewEvent[] = [];
    const hearing: PaneHearing = new PaneHearing(t => changes.push(t));

    event.followIn(hearing);

    const failed: PaneStatus = event.applyTo(PaneStatus.empty);
    expect([failed.state, failed.url, failed.failureReason]).toEqual([PaneState.Failed, "https://gone.example/", "ERR_NAME_NOT_RESOLVED"]);
    expect(changes).toStrictEqual([event]);
  });
});

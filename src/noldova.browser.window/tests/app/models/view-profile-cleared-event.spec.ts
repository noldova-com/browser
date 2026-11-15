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
import { ViewProfileClearedEvent } from "../../../src/app/models/view-profile-cleared-event.ts";
import { PaneHearing } from "../../../src/app/services/pane-hearing.ts";

describe("ViewProfileClearedEvent", () => {
  it("keeps the cleared profile's key, as a view event of its kind", () => {
    const event: ViewProfileClearedEvent = new ViewProfileClearedEvent("workspace-1");

    expect(event).toBeInstanceOf(ViewEvent);
    expect([event.kind, event.profileKey]).toEqual([ViewEventKind.ProfileCleared, "workspace-1"]);
  });

  it("changes nothing shown, and has the hearing change the status by it", () => {
    const event: ViewProfileClearedEvent = new ViewProfileClearedEvent("workspace-1");
    const changes: ViewEvent[] = [];
    const hearing: PaneHearing = new PaneHearing(t => changes.push(t));

    event.followIn(hearing);

    expect(event.applyTo(PaneStatus.empty)).toBe(PaneStatus.empty);
    expect(changes).toStrictEqual([event]);
  });
});

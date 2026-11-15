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
import { ViewKeyEvent } from "../../../src/app/models/view-key-event.ts";
import { PaneHearing } from "../../../src/app/services/pane-hearing.ts";

describe("ViewKeyEvent", () => {
  it("keeps the name of the pane's key, as a view event of its kind", () => {
    const event: ViewKeyEvent = new ViewKeyEvent("reload");

    expect(event).toBeInstanceOf(ViewEvent);
    expect([event.kind, event.name]).toEqual([ViewEventKind.Key, "reload"]);
  });

  it("changes nothing shown, and tells the hearing's key listeners of the key", () => {
    const event: ViewKeyEvent = new ViewKeyEvent("reload");
    const changes: ViewEvent[] = [];
    const hearing: PaneHearing = new PaneHearing(t => changes.push(t));
    const keys: ViewKeyEvent[] = [];
    hearing.onKey(t => keys.push(t));

    event.followIn(hearing);

    expect(event.applyTo(PaneStatus.empty)).toBe(PaneStatus.empty);
    expect([keys, changes]).toStrictEqual([[event], []]);
  });
});

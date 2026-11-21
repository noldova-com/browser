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
import { ViewNewWindowEvent } from "../../../src/app/models/view-new-window-event.ts";
import { PaneHearing } from "../../../src/app/services/pane-hearing.ts";

describe("ViewNewWindowEvent", () => {
  it("keeps the address asked for, whether the person's input came just before and the origin that asked, as a view event of its kind", () => {
    const event: ViewNewWindowEvent = new ViewNewWindowEvent("https://two.example/", true, "https://one.example");

    expect(event).toBeInstanceOf(ViewEvent);
    expect([event.kind, event.address, event.hadRecentInput, event.origin, event.isBackgroundTab, event.isFromPress])
      .toEqual([ViewEventKind.NewWindowRequested, "https://two.example/", true, "https://one.example", false, false]);
  });

  it("keeps whether the engine asked for a background tab, as for a middle or Ctrl click on a link, and whether it used the person's press", () => {
    const event: ViewNewWindowEvent = new ViewNewWindowEvent("https://two.example/", true, null, true, true);

    expect([event.isBackgroundTab, event.isFromPress]).toEqual([true, true]);
  });

  it("changes nothing shown, and tells the hearing's new-window listeners of the request", () => {
    const event: ViewNewWindowEvent = new ViewNewWindowEvent("https://two.example/", true, "https://one.example");
    const changes: ViewEvent[] = [];
    const hearing: PaneHearing = new PaneHearing(t => changes.push(t));
    const asked: ViewNewWindowEvent[] = [];
    hearing.onNewWindow(t => asked.push(t));

    event.followIn(hearing);

    expect(event.applyTo(PaneStatus.empty)).toBe(PaneStatus.empty);
    expect([asked, changes]).toStrictEqual([[event], []]);
  });
});

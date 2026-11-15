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
import { ViewStateEvent } from "../../../src/app/models/view-state-event.ts";
import { PaneHearing } from "../../../src/app/services/pane-hearing.ts";

describe("ViewStateEvent", () => {
  it("keeps the page's address, title, loading and history, as a view event of its kind", () => {
    const event: ViewStateEvent = new ViewStateEvent("https://one.example/", "One", true, false, true);

    expect(event).toBeInstanceOf(ViewEvent);
    expect([event.kind, event.address, event.title, event.isLoading, event.canGoBack, event.canGoForward]).toEqual([ViewEventKind.State, "https://one.example/", "One", true, false, true]);
  });

  it("shows the page's state, and has the hearing change the status by it", () => {
    const event: ViewStateEvent = new ViewStateEvent("https://one.example/", "One", true, false, true);
    const changes: ViewEvent[] = [];
    const hearing: PaneHearing = new PaneHearing(t => changes.push(t));

    event.followIn(hearing);

    const loading: PaneStatus = event.applyTo(PaneStatus.empty);
    expect([loading.state, loading.url, loading.title, loading.canGoForward]).toEqual([PaneState.Loading, "https://one.example/", "One", true]);
    expect(changes).toStrictEqual([event]);
  });
});

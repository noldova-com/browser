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
import { ViewRefusalEvent } from "../../../src/app/models/view-refusal-event.ts";
import { ViewStateEvent } from "../../../src/app/models/view-state-event.ts";
import { PaneHearing } from "../../../src/app/services/pane-hearing.ts";

describe("ViewRefusalEvent", () => {
  it("keeps the refused address, its origin and whether a redirect led there, as a view event of its kind", () => {
    const event: ViewRefusalEvent = new ViewRefusalEvent("https://refused.example/", "https://refused.example", true);

    expect(event).toBeInstanceOf(ViewEvent);
    expect([event.kind, event.address, event.origin, event.isRedirect]).toEqual([ViewEventKind.NavigationRefused, "https://refused.example/", "https://refused.example", true]);
  });

  it("refuses its origin as the page's own navigation, holding the page's load unless the pane is loading, and has the hearing change the status by it", () => {
    const event: ViewRefusalEvent = new ViewRefusalEvent("https://refused.example/", "https://refused.example", false);
    const loading: PaneStatus = PaneStatus.empty.apply(new ViewStateEvent("https://one.example/", "", true, false, false));
    const changes: ViewEvent[] = [];
    const hearing: PaneHearing = new PaneHearing(t => changes.push(t));

    event.followIn(hearing);

    expect([event.applyTo(PaneStatus.empty), event.applyTo(loading)]).toStrictEqual([PaneStatus.empty.refuse("https://refused.example", true, null, true),
      loading.refuse("https://refused.example", false, null, true)]);
    expect(changes).toStrictEqual([event]);
  });
});

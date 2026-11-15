/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { RefusedRequest } from "../../../src/app/enums/refused-request.ts";
import { ViewEventKind } from "../../../src/app/enums/view-event-kind.ts";
import { PaneStatus } from "../../../src/app/models/pane-status.ts";
import { ViewEvent } from "../../../src/app/models/view-event.ts";
import { ViewRequestRefusalEvent } from "../../../src/app/models/view-request-refusal-event.ts";
import { PaneHearing } from "../../../src/app/services/pane-hearing.ts";

describe("ViewRequestRefusalEvent", () => {
  it("keeps the refused request and the origin that asked, as a view event of its kind", () => {
    const event: ViewRequestRefusalEvent = new ViewRequestRefusalEvent(RefusedRequest.Download, "https://one.example");

    expect(event).toBeInstanceOf(ViewEvent);
    expect([event.kind, event.request, event.origin]).toEqual([ViewEventKind.RequestRefused, RefusedRequest.Download, "https://one.example"]);
  });

  it("keeps its refused request beside the page, and has the hearing change the status by it", () => {
    const event: ViewRequestRefusalEvent = new ViewRequestRefusalEvent(RefusedRequest.Download, "https://one.example");
    const changes: ViewEvent[] = [];
    const hearing: PaneHearing = new PaneHearing(t => changes.push(t));

    event.followIn(hearing);

    expect(event.applyTo(PaneStatus.empty).refusedRequest).toBe(RefusedRequest.Download);
    expect(changes).toStrictEqual([event]);
  });
});

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
import { ViewFaviconEvent } from "../../../src/app/models/view-favicon-event.ts";
import { PaneHearing } from "../../../src/app/services/pane-hearing.ts";

const ICON: string = "data:image/png;base64,iVBORw0KGgo=";

describe("ViewFaviconEvent", () => {
  it("keeps the page's icon, or none, as a view event of its kind", () => {
    const event: ViewFaviconEvent = new ViewFaviconEvent(ICON);

    expect(event).toBeInstanceOf(ViewEvent);
    expect([event.kind, event.image, new ViewFaviconEvent(null).image]).toEqual([ViewEventKind.Favicon, ICON, null]);
  });

  it("changes nothing shown, and gives the hearing the page's new icon", () => {
    const event: ViewFaviconEvent = new ViewFaviconEvent(ICON);
    const changes: ViewEvent[] = [];
    const hearing: PaneHearing = new PaneHearing(t => changes.push(t));
    const images: (string | null)[] = [];
    hearing.onFavicon(t => images.push(t));

    event.followIn(hearing);

    expect(event.applyTo(PaneStatus.empty)).toBe(PaneStatus.empty);
    expect([hearing.favicon, images, changes]).toStrictEqual([ICON, [ICON], []]);
  });
});

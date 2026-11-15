/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageAction } from "@noldova/browser.protocol";
import { describe, expect, it } from "vitest";

import { PageActivity } from "../../src/models/page-activity.ts";
import { PageStops } from "../../src/models/page-stops.ts";
import { SessionPage } from "../../src/models/session-page.ts";

describe("PageStops", () => {
  function activityOf(instance: string, session: string): PageActivity {
    return new PageActivity(new SessionPage("view-1", instance, "workspace-1", "Scout"), session, PageAction.Reading, new AbortController().signal, () => undefined);
  }

  it("stops every call running on the page, and none on another page or one that ended", () => {
    const stops: PageStops = new PageStops();
    const first: PageActivity = activityOf("page-1", "session-1");
    const second: PageActivity = activityOf("page-1", "session-2");
    const ended: PageActivity = activityOf("page-1", "session-1");
    const other: PageActivity = activityOf("page-2", "session-1");
    for (const activity of [first, second, ended, other])
      stops.add(activity);
    stops.remove(ended);

    stops.stop("page-1", false);

    expect([first, second, ended, other].map(t => t.signal.aborted)).toEqual([true, true, false, false]);
    expect([stops.isTakenOver("page-1", "session-1"), stops.isTakenOver("page-1", "session-2")]).toEqual([false, false]);
  });

  it("counts each stop of a page, and none of another page", () => {
    const stops: PageStops = new PageStops();
    stops.stop("page-1", false);
    stops.stop("page-1", true);

    expect([stops.generationOf("page-1"), stops.generationOf("page-2")]).toEqual([2, 0]);
  });

  it("takes the page from the session that last acted on it, and from each session the person took it from, until each ends", () => {
    const stops: PageStops = new PageStops();
    stops.add(activityOf("page-1", "session-1"));
    stops.stop("page-1", true);
    const second: PageActivity = activityOf("page-1", "session-2");
    stops.add(second);
    stops.remove(second);
    stops.stop("page-1", true);

    expect([stops.isTakenOver("page-1", "session-1"), stops.isTakenOver("page-1", "session-2"), stops.isTakenOver("page-2", "session-1")]).toEqual([true, true, false]);
    stops.endSession("session-2");
    expect([stops.isTakenOver("page-1", "session-1"), stops.isTakenOver("page-1", "session-2")]).toEqual([true, false]);
    stops.endSession("session-1");
    expect(stops.isTakenOver("page-1", "session-1")).toBe(false);
  });

  it("takes nothing from a page no session acted on, or whose last session ended, and forgets a call it never ran", () => {
    const stops: PageStops = new PageStops();
    stops.remove(activityOf("page-1", "session-1"));
    stops.stop("page-1", true);
    stops.add(activityOf("page-2", "session-1"));
    stops.add(activityOf("page-3", "session-2"));
    stops.endSession("session-1");

    stops.stop("page-2", true);
    stops.stop("page-3", true);

    expect([stops.isTakenOver("page-1", "session-1"), stops.isTakenOver("page-2", "session-1"), stops.isTakenOver("page-3", "session-2")]).toEqual([false, false, true]);
  });
});

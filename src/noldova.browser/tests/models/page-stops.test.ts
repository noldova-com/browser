/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageAction } from "@noldova/browser.protocol";
import { beforeEach, describe, expect, it } from "vitest";

import type { PageActivity } from "../../src/models/page-activity.ts";
import { PageStops } from "../../src/models/page-stops.ts";
import { SessionPage } from "../../src/models/session-page.ts";
import type { JsonObject } from "../../src/types/json-value.ts";

describe("PageStops", () => {
  let published: JsonObject[];
  let released: string[];
  let stops: PageStops;

  // As the tool kit does as it asks for the view to be marked as controlled.
  function begin(instance: string, session: string, action: PageAction = PageAction.Reading): PageActivity {
    const control: PageActivity = stops.begin(new SessionPage(`view-of-${instance}`, instance, "workspace-1", "Scout"), session, action, new AbortController().signal);
    control.mark(`view-of-${instance}`);
    return control;
  }

  function run(instance: string, session: string): PageActivity {
    const control: PageActivity = begin(instance, session);
    stops.finish(control);
    return control;
  }

  function events(): unknown[][] {
    return published.map(t => [t["instance"], t["state"]]);
  }

  beforeEach(() => {
    published = [];
    released = [];
    stops = new PageStops(t => published.push(t), t => released.push(t));
  });

  it("lets go of a control's view as the control ends, by a stop, a close, its session's end once its call ends, or another session, and knows the views it holds", () => {
    run("page-1", "session-1");
    run("page-2", "session-1");
    const calling: PageActivity = begin("page-3", "session-1");
    run("page-4", "session-2");
    const held: boolean[] = [1, 2, 3, 4, 5].map(t => stops.controlsView(`view-of-page-${t}`));

    stops.stop("page-1", false);
    stops.close("page-2");
    stops.endSession("session-1");
    const beforeItsCallEnds: string[] = [...released];
    stops.finish(calling);
    run("page-4", "session-3");

    expect(held).toEqual([true, true, true, true, false]);
    expect(beforeItsCallEnds).toEqual(["view-of-page-1", "view-of-page-2"]);
    expect(released).toEqual(["view-of-page-1", "view-of-page-2", "view-of-page-3", "view-of-page-4"]);
    expect(["view-of-page-3", "view-of-page-4"].map(t => stops.controlsView(t))).toEqual([false, true]);
  });

  it("holds both the view a control marked and the one its page is in now, and lets go only of a marked one as the control ends", () => {
    const control: PageActivity = run("page-1", "session-1");
    stops.begin(new SessionPage("view-2", "page-1", "workspace-1", "Scout"), "session-1", PageAction.Reading, new AbortController().signal);
    const held: boolean[] = ["view-of-page-1", "view-2"].map(t => stops.controlsView(t));

    control.mark(null);
    stops.finish(control);
    stops.stop("page-1", false);

    expect([held, control.viewId, released]).toEqual([[true, true], "view-2", []]);
  });

  it("counts the calls on a page that can move it, navigating, clicking, typing and pressing a key, and no other", () => {
    for (const action of Object.values(PageAction))
      stops.finish(begin("page-1", "session-1", action));
    begin("page-2", "session-1", PageAction.Clicking);

    expect([stops.movesOn("page-1"), stops.movesOn("page-2"), stops.movesOn("page-3")]).toEqual([4, 1, 0]);
  });

  it("keeps one control of a page across a session's calls, resting between them, and lists it", () => {
    const first: PageActivity = run("page-1", "session-1");
    const second: PageActivity = begin("page-1", "session-1", PageAction.Clicking);

    expect(second).toBe(first);
    expect(events()).toEqual([["page-1", "Acting"], ["page-1", "Idle"], ["page-1", "Acting"]]);
    expect(stops.activities()).toEqual([expect.objectContaining({ instance: "page-1", action: "Clicking", state: "Acting" })]);
  });

  it("ends a session's control of a page when another session calls on it", () => {
    const first: PageActivity = run("page-1", "session-1");
    const second: PageActivity = run("page-1", "session-2");

    expect(second).not.toBe(first);
    expect(events()).toEqual([["page-1", "Acting"], ["page-1", "Idle"], ["page-1", "Ended"], ["page-1", "Acting"], ["page-1", "Idle"]]);
  });

  it("ends a resting control at once when the person stops it, and a calling one once its call ends, stopping its call; another page's goes on", () => {
    const resting: PageActivity = run("page-1", "session-1");
    const calling: PageActivity = begin("page-2", "session-1");
    run("page-3", "session-1");

    stops.stop("page-1", false);
    stops.stop("page-2", false);
    const stoppedEvents: unknown[][] = events().slice(5);
    stops.finish(calling);

    expect([resting.signal.aborted, calling.signal.aborted]).toEqual([true, true]);
    expect(stoppedEvents).toEqual([["page-1", "Ended"]]);
    expect(events().slice(6)).toEqual([["page-2", "Ended"]]);
    expect(stops.activities()).toEqual([expect.objectContaining({ instance: "page-3", state: "Idle" })]);
    expect([stops.isTakenOver("page-1", "session-1"), stops.isTakenOver("page-2", "session-1")]).toEqual([false, false]);
  });

  it("ends a page's control when the page closes, a calling one once its call ends, and does nothing for a page with none", () => {
    run("page-1", "session-1");
    const calling: PageActivity = begin("page-2", "session-1");

    stops.close("page-1");
    stops.close("page-2");
    stops.close("page-3");
    const closedEvents: unknown[][] = events().slice(3);
    stops.finish(calling);

    expect([closedEvents, events().slice(4)]).toEqual([[["page-1", "Ended"]], [["page-2", "Ended"]]]);
    expect(stops.activities()).toEqual([]);
  });

  it("ends a session's controls when it ends, a calling one once its call ends, and keeps another session's", () => {
    run("page-1", "session-1");
    const calling: PageActivity = begin("page-2", "session-1");
    run("page-3", "session-2");

    stops.endSession("session-1");
    const endedEvents: unknown[][] = events().slice(5);
    stops.finish(calling);

    expect([endedEvents, events().slice(6)]).toEqual([[["page-1", "Ended"]], [["page-2", "Ended"]]]);
    expect(stops.activities()).toEqual([expect.objectContaining({ instance: "page-3" })]);
  });

  it("ends a control whose page the person took in its call, once the call ends", () => {
    const control: PageActivity = begin("page-1", "session-1");
    control.handOver();
    stops.finish(control);

    expect(events()).toEqual([["page-1", "Acting"], ["page-1", "Ended"]]);
  });

  it("counts each stop of a page, and none of another page", () => {
    stops.stop("page-1", false);
    stops.stop("page-1", true);

    expect([stops.generationOf("page-1"), stops.generationOf("page-2")]).toEqual([2, 0]);
  });

  it("takes the page from the session that last acted on it, and from each session the person took it from, until each ends", () => {
    run("page-1", "session-1");
    stops.stop("page-1", true);
    run("page-1", "session-2");
    stops.stop("page-1", true);

    expect([stops.isTakenOver("page-1", "session-1"), stops.isTakenOver("page-1", "session-2"), stops.isTakenOver("page-2", "session-1")]).toEqual([true, true, false]);
    stops.endSession("session-2");
    expect([stops.isTakenOver("page-1", "session-1"), stops.isTakenOver("page-1", "session-2")]).toEqual([true, false]);
    stops.endSession("session-1");
    expect(stops.isTakenOver("page-1", "session-1")).toBe(false);
  });

  it("takes nothing from a page no session acted on, or whose last session ended", () => {
    stops.stop("page-1", true);
    run("page-2", "session-1");
    run("page-3", "session-2");
    stops.endSession("session-1");

    stops.stop("page-2", true);
    stops.stop("page-3", true);

    expect([stops.isTakenOver("page-1", "session-1"), stops.isTakenOver("page-2", "session-1"), stops.isTakenOver("page-3", "session-2")]).toEqual([false, false, true]);
  });
});

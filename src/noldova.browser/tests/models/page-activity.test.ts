/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageAction, PageBox, PagePoint, PageRefusal } from "@noldova/browser.protocol";
import { ToolAbortReason } from "@noldova/desktop.runtime";
import { beforeEach, describe, expect, it } from "vitest";

import { PageActivity } from "../../src/models/page-activity.ts";
import { SessionPage } from "../../src/models/session-page.ts";
import type { JsonObject } from "../../src/types/json-value.ts";

describe("PageActivity", () => {
  let published: JsonObject[];
  let call: AbortController;
  let activity: PageActivity;

  function states(): readonly unknown[] {
    return published.map(t => t["state"]);
  }

  beforeEach(() => {
    published = [];
    call = new AbortController();
    activity = new PageActivity(new SessionPage("view-1", "page-1", "workspace-1", "Scout"),"session-1", PageAction.Typing, call.signal,
      t => published.push(t));
  });

  it("publishes the whole activity as it starts, with its page, its own id and the agent's name", () => {
    expect(published).toEqual([{ instance: "page-1", activity: expect.stringMatching(/^[0-9a-f-]{36}$/u), agentName: "Scout", action: "Typing", state: "Acting",
      box: null, point: null, refusal: null, isHandedOver: false }]);
  });

  it("publishes only a change of state, so acting again says nothing", () => {
    activity.act();
    activity.ask();
    activity.ask();
    activity.act();

    expect(states()).toEqual(["Acting", "Asking", "Acting"]);
  });

  it("publishes its end once, and nothing after it", () => {
    activity[Symbol.dispose]();
    activity[Symbol.dispose]();
    activity.ask();
    activity.aim(new PageBox(1, 2, 3, 4), new PagePoint(2, 4));

    expect(states()).toEqual(["Acting", "Ended"]);
  });

  it("names its page and session, and aborts its signal as stopped when the person stops it, without the call's own signal", () => {
    activity.stop();

    expect([activity.instance, activity.session, activity.signal.reason, activity.stopSignal.reason, call.signal.aborted])
      .toEqual(["page-1", "session-1", ToolAbortReason.Stopped, ToolAbortReason.Stopped, false]);
  });

  it("aborts its signal as the call's own does, and its stop signal not", () => {
    call.abort(ToolAbortReason.Cancelled);

    expect([activity.signal.reason, activity.stopSignal.aborted]).toEqual([ToolAbortReason.Cancelled, false]);
  });

  it("carries the address a navigation ends without in its end, after its request was answered", () => {
    activity.ask();
    activity.act();
    activity.refuse(new PageRefusal("https://docs.example.com/pricing", "https://docs.example.com"));
    activity[Symbol.dispose]();

    expect(published.map(t => [t["state"], t["refusal"]])).toEqual([["Acting", null], ["Asking", null], ["Acting", null],
      ["Ended", { url: "https://docs.example.com/pricing", origin: "https://docs.example.com" }]]);
  });

  it("keeps the same id in each event, and gives another activity another", () => {
    activity.aim(new PageBox(1, 2, 3, 4), null);
    const other: PageActivity = new PageActivity(new SessionPage("view-1", "page-1", "workspace-1", ""),"session-1", PageAction.Reading,
      call.signal, t => published.push(t));
    other[Symbol.dispose]();

    expect([published[0]?.["activity"] === published[1]?.["activity"], published[1]?.["activity"] === published[2]?.["activity"]]).toEqual([true, false]);
    expect(published[1]?.["box"]).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });

  it("publishes a box it follows only while it asks and only when it changes, keeps the click's point, and follows nothing once answered", () => {
    const box: PageBox = new PageBox(1, 2, 3, 4);
    const point: PagePoint = new PagePoint(2, 4);
    activity.aim(box, point);
    activity.follow(new PageBox(1, 50, 3, 4));
    activity.ask();
    activity.follow(new PageBox(1, 2, 3, 4));
    activity.follow(new PageBox(1, 12, 3, 4));
    activity.follow(null);
    activity.follow(null);
    activity.follow(box);
    for (const moved of [new PageBox(9, 2, 3, 4), new PageBox(9, 2, 7, 4), new PageBox(9, 2, 7, 8)])
      activity.follow(moved);
    activity.act();
    activity.follow(new PageBox(1, 30, 3, 4));
    activity[Symbol.dispose]();
    activity.follow(new PageBox(1, 40, 3, 4));

    const last: PageBox = new PageBox(9, 2, 7, 8);
    expect(published.slice(1).map(t => [t["state"], t["box"], t["point"]])).toEqual([
      ["Acting", box, point], ["Asking", box, point], ["Asking", { ...box, y: 12 }, point], ["Asking", null, point], ["Asking", box, point],
      ["Asking", { ...box, x: 9 }, point], ["Asking", { ...box, x: 9, width: 7 }, point], ["Asking", last, point], ["Acting", last, point], ["Ended", last, point]
    ]);
  });
});

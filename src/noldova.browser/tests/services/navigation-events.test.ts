/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";
import { WebViewProtocolEvent } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { NavigationEvents } from "../../src/services/navigation-events.ts";
import type { JsonObject } from "../../src/types/json-value.ts";

describe("NavigationEvents", () => {
  const event = (method: string, params: JsonObject): WebViewProtocolEvent => new WebViewProtocolEvent("view-1", method, params, false);
  // Each kind's details, as the protocol requires them.
  const DETAILS: ReadonlyMap<WebViewEventKind, JsonObject> = new Map<WebViewEventKind, JsonObject>([
    [WebViewEventKind.NavigationRefused, { address: "https://shop.test/help", origin: "https://shop.test", isRedirect: false }],
    [WebViewEventKind.Crashed, {}],
    [WebViewEventKind.Closed, {}],
    [WebViewEventKind.LoadFailed, { address: "https://shop.test/help", code: -2, description: "net::ERR_FAILED" }]
  ]);
  const viewEvent = (viewId: string, kind: WebViewEventKind): WebViewEvent => new WebViewEvent("browser", viewId, kind, DETAILS.get(kind) ?? {});

  it("ends every navigation of the view on its refused navigation, crash or close, and on nothing of another view or kind", () => {
    const ends: boolean[] = [WebViewEventKind.NavigationRefused, WebViewEventKind.Crashed, WebViewEventKind.Closed, WebViewEventKind.LoadFailed]
      .map(t => NavigationEvents.isViewEnd(viewEvent("view-1", t), "view-1"));

    expect([...ends, NavigationEvents.isViewEnd(viewEvent("view-2", WebViewEventKind.Closed), "view-1")]).toEqual([true, true, true, false, false]);
  });

  it("starts a navigation of the frame to another document, and none within its document or of another frame", () => {
    const starts: boolean[] = ["differentDocument", "reload", "sameDocument", "historySameDocument"]
      .map(t => NavigationEvents.isDocumentStart(event("Page.frameStartedNavigating", { frameId: "main", url: "https://shop.test/", navigationType: t }), "main"));
    const other: boolean = NavigationEvents.isDocumentStart(event("Page.frameStartedNavigating", { frameId: "inner", navigationType: "differentDocument" }), "main");
    const otherEvent: boolean = NavigationEvents.isDocumentStart(event("Page.frameNavigated", { frameId: "main", navigationType: "differentDocument" }), "main");

    expect([...starts, other, otherEvent]).toEqual([true, true, false, false, false, false]);
  });

  it("finds the frame's commit by the navigated frame's id, and none of another frame, without a frame or of another event", () => {
    const commits: boolean[] = [
      event("Page.frameNavigated", { frame: { id: "main", url: "https://shop.test/" } }),
      event("Page.frameNavigated", { frame: { id: "inner", url: "https://shop.test/" } }),
      event("Page.frameNavigated", { frame: "main" }),
      event("Page.frameStoppedLoading", { frame: { id: "main" } }),
    ].map(t => NavigationEvents.isCommit(t, "main"));

    expect(commits).toEqual([true, false, false, false]);
  });

  it("finds the frame's stop, and none of another frame or event", () => {
    const stops: boolean[] = [
      event("Page.frameStoppedLoading", { frameId: "main" }),
      event("Page.frameStoppedLoading", { frameId: "inner" }),
      event("Page.frameStartedLoading", { frameId: "main" }),
    ].map(t => NavigationEvents.isStop(t, "main"));

    expect(stops).toEqual([true, false, false]);
  });
});

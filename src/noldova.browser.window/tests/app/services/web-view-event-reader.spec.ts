/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";
import { describe, expect, it } from "vitest";

import { RefusedRequest } from "../../../src/app/enums/refused-request.ts";
import { ViewCloseEvent } from "../../../src/app/models/view-close-event.ts";
import { ViewCrashEvent } from "../../../src/app/models/view-crash-event.ts";
import type { ViewEvent } from "../../../src/app/models/view-event.ts";
import { ViewKeyEvent } from "../../../src/app/models/view-key-event.ts";
import { ViewLoadFailureEvent } from "../../../src/app/models/view-load-failure-event.ts";
import { ViewNewWindowEvent } from "../../../src/app/models/view-new-window-event.ts";
import { ViewProfileClearedEvent } from "../../../src/app/models/view-profile-cleared-event.ts";
import { ViewRefusalEvent } from "../../../src/app/models/view-refusal-event.ts";
import { ViewRequestRefusalEvent } from "../../../src/app/models/view-request-refusal-event.ts";
import { ViewStateEvent } from "../../../src/app/models/view-state-event.ts";
import { ViewZoomEvent } from "../../../src/app/models/view-zoom-event.ts";
import { WebViewEventReader } from "../../../src/app/services/web-view-event-reader.ts";
import { WebViewValues } from "../../fixtures/fake-web-views.fixture.ts";

describe("WebViewEventReader", () => {
  function event(kind: WebViewEventKind, details: ConstructorParameters<typeof WebViewEvent>[3] = {}): WebViewEvent {
    return new WebViewEvent("browser", "view-1", kind, details);
  }

  function malformed(kind: WebViewEventKind, details: WebViewEvent["details"]): WebViewEvent {
    return { module: "browser", view: "view-1", kind, details, toJson: () => ({}) };
  }

  it("reads a closed view and a crashed page, which carry no details", () => {
    expect(WebViewEventReader.read(event(WebViewEventKind.Closed))).toStrictEqual(new ViewCloseEvent());
    expect(WebViewEventReader.read(event(WebViewEventKind.Crashed))).toStrictEqual(new ViewCrashEvent());
  });

  it("reads the page's state with its address, title, loading and history", () => {
    expect(WebViewEventReader.read(event(WebViewEventKind.State, { address: "https://one.example/", title: "One", isLoading: true, canGoBack: false, canGoForward: true }))).toStrictEqual(new ViewStateEvent("https://one.example/", "One", true, false, true));
  });

  it("reads a failed load with its address, the engine's code and its description", () => {
    expect(WebViewEventReader.read(event(WebViewEventKind.LoadFailed, { address: "https://gone.example/", code: -105, description: "ERR_NAME_NOT_RESOLVED" }))).toStrictEqual(new ViewLoadFailureEvent("https://gone.example/", -105, "ERR_NAME_NOT_RESOLVED"));
  });

  it("reads a refused navigation with its address, its origin and whether a redirect led there", () => {
    expect(WebViewEventReader.read(event(WebViewEventKind.NavigationRefused, { address: "https://refused.example/", origin: "https://refused.example", isRedirect: true }))).toStrictEqual(new ViewRefusalEvent("https://refused.example/", "https://refused.example", true));
  });

  it("reads a cleared profile with its key", () => {
    expect(WebViewEventReader.read(event(WebViewEventKind.ProfileCleared, { profileKey: "workspace-1" }))).toStrictEqual(new ViewProfileClearedEvent("workspace-1"));
  });

  it("reads each request the host refuses, with the origin that asked", () => {
    const requests: string[] = ["download", "newWindow", "permission", "fileChooser", "authentication", "certificate", "nestedView"];

    expect(requests.map(t => WebViewEventReader.read(event(WebViewEventKind.RequestRefused, { request: t, origin: "https://one.example" }))))
      .toStrictEqual(Object.values(RefusedRequest).filter(t => t !== RefusedRequest.PopupSites).map(t => new ViewRequestRefusalEvent(t, "https://one.example")));
  });

  it("reads a new window the page asked for, with whether the person's input asked and the origin that asked, if any", () => {
    expect(WebViewEventReader.read(event(WebViewEventKind.NewWindowRequested, { address: "https://two.example/", hadRecentInput: true, origin: "https://one.example" })))
      .toStrictEqual(new ViewNewWindowEvent("https://two.example/", true, "https://one.example"));
    expect(WebViewEventReader.read(event(WebViewEventKind.NewWindowRequested, { address: "https://two.example/", hadRecentInput: false, origin: null })))
      .toStrictEqual(new ViewNewWindowEvent("https://two.example/", false, null));
  });

  it("reads a new window's disposition as whether the engine asked for a background tab", () => {
    const read = (disposition: string): ViewEvent | null =>
      WebViewEventReader.read(event(WebViewEventKind.NewWindowRequested, { address: "https://two.example/", hadRecentInput: true, origin: null, disposition }));

    expect(["background-tab", "foreground-tab", "new-window", "default"].map(read)).toStrictEqual([
      new ViewNewWindowEvent("https://two.example/", true, null, true),
      new ViewNewWindowEvent("https://two.example/", true, null, false),
      new ViewNewWindowEvent("https://two.example/", true, null, false),
      new ViewNewWindowEvent("https://two.example/", true, null, false)
    ]);
  });

  it("reads whether a new window used the person's press, and takes an event without it as one that didn't", () => {
    const read = (fromPress: boolean | undefined): ViewEvent | null => WebViewEventReader.read(event(WebViewEventKind.NewWindowRequested,
      { address: "https://two.example/", hadRecentInput: true, origin: null, disposition: "background-tab", ...(Object.isUndefined(fromPress) ? {} : { fromPress }) }));

    expect([true, false, undefined].map(read)).toStrictEqual([
      new ViewNewWindowEvent("https://two.example/", true, null, true, true),
      new ViewNewWindowEvent("https://two.example/", true, null, true, false),
      new ViewNewWindowEvent("https://two.example/", true, null, true, false)
    ]);
  });

  it("reads the name of the pane's key the person pressed in the page", () => {
    expect(WebViewEventReader.read(event(WebViewEventKind.Key, { name: "reload" }))).toStrictEqual(new ViewKeyEvent("reload"));
  });

  it("reads the view's new zoom factor", () => {
    expect(WebViewEventReader.read(event(WebViewEventKind.Zoom, { factor: 1.25 }))).toStrictEqual(new ViewZoomEvent(1.25));
  });

  it("reads nothing for a zoom factor that isn't a finite number above zero, so the pane never shows one as a size", () => {
    expect([Number.NaN, Number.POSITIVE_INFINITY, 0, -1.25].map(t => WebViewEventReader.read(malformed(WebViewEventKind.Zoom, { factor: t }))))
      .toEqual([null, null, null, null]);
  });

  it("reads nothing for the kinds the pane doesn't follow", () => {
    expect([
      event(WebViewEventKind.Opened, { pane: WebViewValues.page.toJson(), profileKey: "workspace-1" }),
      event(WebViewEventKind.Protocol, { method: "Page.loadEventFired", params: {}, isCut: false }),
      event(WebViewEventKind.Dropped, { count: 3 })
    ].map(t => WebViewEventReader.read(t))).toEqual([null, null, null]);
  });

  it("reads nothing for details without their kind's fields, rather than guess", () => {
    expect([
      malformed(WebViewEventKind.State, { address: "https://one.example/", title: 1, isLoading: false, canGoBack: false, canGoForward: false }),
      malformed(WebViewEventKind.LoadFailed, { address: "https://gone.example/", code: "-105", description: "ERR_FAILED" }),
      malformed(WebViewEventKind.NavigationRefused, { address: "https://refused.example/", origin: "https://refused.example" }),
      malformed(WebViewEventKind.ProfileCleared, { profileKey: null }),
      malformed(WebViewEventKind.RequestRefused, { request: "camera", origin: "https://one.example" }),
      malformed(WebViewEventKind.RequestRefused, { request: "Download", origin: "https://one.example" }),
      malformed(WebViewEventKind.RequestRefused, { request: "download" }),
      malformed(WebViewEventKind.RequestRefused, { request: "popupSites", origin: "https://one.example" }),
      malformed(WebViewEventKind.RequestRefused, { origin: "https://one.example" }),
      malformed(WebViewEventKind.NewWindowRequested, { address: 1, hadRecentInput: true, origin: null }),
      malformed(WebViewEventKind.NewWindowRequested, { address: "https://two.example/", hadRecentInput: "yes", origin: null }),
      malformed(WebViewEventKind.NewWindowRequested, { address: "https://two.example/", hadRecentInput: true, origin: 1 }),
      malformed(WebViewEventKind.NewWindowRequested, { address: "https://two.example/", hadRecentInput: true, origin: null, disposition: 1 }),
      malformed(WebViewEventKind.NewWindowRequested, { address: "https://two.example/", hadRecentInput: true, origin: null, fromPress: "yes" }),
      malformed(WebViewEventKind.Key, { name: 1 }),
      malformed(WebViewEventKind.Zoom, { factor: "125%" })
    ].map(t => WebViewEventReader.read(t))).toEqual([null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null]);
  });
});

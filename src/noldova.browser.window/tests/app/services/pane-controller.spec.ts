/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewEventKind } from "@noldova/desktop.protocol";
import { TypedAddressRefusal } from "@noldova/browser.protocol";
import type { IWebViewFound } from "@noldova/desktop.window";
import { describe, expect, it } from "vitest";

import { PaneState } from "../../../src/app/enums/pane-state.ts";
import { RefusedRequest } from "../../../src/app/enums/refused-request.ts";
import { PaneUnavailableException } from "../../../src/app/exceptions/pane-unavailable.exception.ts";
import { PaneStatus } from "../../../src/app/models/pane-status.ts";
import { PopupOffer } from "../../../src/app/models/popup-offer.ts";
import { ViewCloseEvent } from "../../../src/app/models/view-close-event.ts";
import { ViewCrashEvent } from "../../../src/app/models/view-crash-event.ts";
import { ViewKeyEvent } from "../../../src/app/models/view-key-event.ts";
import { ViewLoadFailureEvent } from "../../../src/app/models/view-load-failure-event.ts";
import { ViewNewWindowEvent } from "../../../src/app/models/view-new-window-event.ts";
import { ViewProfileClearedEvent } from "../../../src/app/models/view-profile-cleared-event.ts";
import { ViewRefusalEvent } from "../../../src/app/models/view-refusal-event.ts";
import { ViewRequestRefusalEvent } from "../../../src/app/models/view-request-refusal-event.ts";
import { ViewStateEvent } from "../../../src/app/models/view-state-event.ts";
import { ViewZoomEvent } from "../../../src/app/models/view-zoom-event.ts";
import { PaneController } from "../../../src/app/services/pane-controller.ts";
import { FakeWebView, FakeWebViews, WebViewValues } from "../../fixtures/fake-web-views.fixture.ts";

describe("PaneController", () => {
  function open(): { surface: FakeWebViews; view: FakeWebView; controller: PaneController } {
    const surface: FakeWebViews = new FakeWebViews();
    const view: FakeWebView = surface.open("workspace-1");
    return { surface, view, controller: new PaneController(view) };
  }

  it("starts empty", () => {
    expect(open().controller.status.state).toBe(PaneState.Empty);
  });

  it("follows the page through a load and tells each listener of each change", async () => {
    const { surface, controller } = open();
    surface.script("https://one.example/", { kind: "load", title: "One" });
    const states: string[] = [];
    controller.onChange(t => states.push(t.state));

    expect(await controller.navigateAsync("https://one.example/")).toEqual(WebViewValues.started);

    expect(states).toEqual([PaneState.Loading, PaneState.Loaded]);
    expect(controller.status.url).toBe("https://one.example/");
    expect(controller.status.title).toBe("One");
  });

  it("goes back, forward, reloads and stops through the view, and passes on its answers", async () => {
    const { view, controller } = open();
    await controller.navigateAsync("https://one.example/");
    await controller.navigateAsync("https://two.example/");

    expect(await controller.goBackAsync()).toEqual(WebViewValues.started);
    expect(controller.status.url).toBe("https://one.example/");
    expect(controller.status.canGoForward).toBe(true);
    expect(await controller.goForwardAsync()).toEqual(WebViewValues.started);
    expect(controller.status.url).toBe("https://two.example/");
    expect(await controller.goForwardAsync()).toEqual(WebViewValues.noHistory);
    expect(await controller.reloadAsync()).toEqual(WebViewValues.started);
    expect(await controller.stopAsync()).toEqual(WebViewValues.started);

    expect(controller.status.state).toBe(PaneState.Loaded);
    expect(view.calls).toEqual(["navigate https://one.example/", "navigate https://two.example/", "back", "forward", "forward", "reload", "stop"]);
  });

  it("tells each navigation it starts before the view gets it, not a stop or a page's own load, until the listener stops or it closes", async () => {
    const { view, controller } = open();
    const seen: string[] = [];
    const stop: () => void = controller.onNavigationStart(() => seen.push(`start after ${String(view.calls.length)} calls`));
    controller.onNavigationStart(() => seen.push("other"));

    await controller.navigateAsync("https://one.example/");
    await controller.navigateAsync("https://two.example/");
    await controller.goBackAsync();
    await controller.goForwardAsync();
    await controller.reloadAsync();
    await controller.stopAsync();
    view.emit(new ViewStateEvent("https://three.example/", "Three", true, true, false));
    stop();
    await controller.reloadAsync();
    controller.close();
    await controller.navigateAsync("https://four.example/").catch(() => undefined);

    expect(seen).toEqual(["start after 0 calls", "other", "start after 1 calls", "other", "start after 2 calls", "other", "start after 3 calls", "other", "start after 4 calls", "other", "other"]);
  });

  it("shows a refused answer to a navigation or a move, a refused redirect, and a crash", async () => {
    const { surface, view, controller } = open();
    surface.script("https://refused.example/", { kind: "refuse" });
    surface.script("https://old.example/", { kind: "redirect", to: "https://refused.example/", title: "" });

    expect(await controller.navigateAsync("https://refused.example/")).toEqual(WebViewValues.refused("https://refused.example"));
    expect(controller.status.state).toBe(PaneState.Refused);
    expect(controller.status.refusedOrigin).toBe("https://refused.example");

    await controller.navigateAsync("https://one.example/");
    await controller.navigateAsync("https://two.example/");
    surface.script("https://one.example/", { kind: "refuse" });
    expect(await controller.goBackAsync()).toEqual(WebViewValues.refused("https://one.example"));
    expect(controller.status.refusedOrigin).toBe("https://one.example");

    await controller.navigateAsync("https://old.example/");
    expect(controller.status.state).toBe(PaneState.Refused);
    expect(controller.status.refusedOrigin).toBe("https://refused.example");
    expect(controller.status.failureReason).toBeNull();
    expect(controller.status.url).toBe("https://two.example/");

    view.crash();
    expect(controller.status.state).toBe(PaneState.Crashed);
  });

  it("loads a crashed page's address again on reload, since the view answers a crashed page's reload with no history", async () => {
    const { surface, view, controller } = open();
    surface.script("https://one.example/", { kind: "load", title: "One" });
    await controller.navigateAsync("https://one.example/");
    view.crash();

    expect(await controller.reloadAsync()).toEqual(WebViewValues.started);

    expect([controller.status.state, controller.status.url, controller.status.title]).toEqual([PaneState.Loaded, "https://one.example/", "One"]);
    expect(view.calls).toEqual(["navigate https://one.example/", "reload", "navigate https://one.example/"]);
  });

  it("loads the page's address again on reload after a refused navigation left the page crashed under the refusal", async () => {
    const { surface, view, controller } = open();
    surface.script("https://one.example/", { kind: "load", title: "One" });
    surface.script("https://refused.example/", { kind: "refuse" });
    await controller.navigateAsync("https://one.example/");
    view.crash();
    await controller.navigateAsync("https://refused.example/");
    expect([controller.status.state, controller.status.url]).toEqual([PaneState.Refused, "https://one.example/"]);

    expect(await controller.reloadAsync()).toEqual(WebViewValues.started);

    expect([controller.status.state, controller.status.url, controller.status.title]).toEqual([PaneState.Loaded, "https://one.example/", "One"]);
    expect(view.calls).toEqual(["navigate https://one.example/", "navigate https://refused.example/", "reload", "navigate https://one.example/"]);
  });

  it("reloads a crashed page with no address through the view, which has nothing to reload", async () => {
    const { view, controller } = open();
    view.crash();

    expect(await controller.reloadAsync()).toEqual(WebViewValues.noHistory);

    expect(view.calls).toEqual(["reload"]);
  });

  it("keeps a page's own refused navigation shown through its load, and clears it for the person's reload, whose load starts before its answer", async () => {
    const { view, controller } = open();
    await controller.navigateAsync("https://one.example/");
    view.emit(new ViewRefusalEvent("https://refused.example/a", "https://refused.example", false));
    view.emit(new ViewStateEvent("https://one.example/", "", true, false, false));
    view.emit(new ViewStateEvent("https://one.example/", "", false, false, false));
    expect([controller.status.state, controller.status.refusedOrigin]).toEqual([PaneState.Refused, "https://refused.example"]);
    view.emit(new ViewRefusalEvent("https://refused.example/a", "https://refused.example", false));

    expect(await controller.reloadAsync()).toEqual(WebViewValues.started);
    expect([controller.status.state, controller.status.refusedOrigin]).toEqual([PaneState.Loaded, null]);
  });

  it("asks its listeners about a refused redirect first, and shows neither refusal nor the cancel's failure for one a listener takes on", async () => {
    const { surface, view, controller } = open();
    surface.script("https://old.example/", { kind: "redirect", to: "https://new.example/", title: "", isRefused: true });
    const asked: string[] = [];
    const states: string[] = [];
    controller.onChange(t => states.push(t.state));
    const stop = controller.onRefusedRedirect(t => asked.push(`${t.address} ${t.origin}`) > 0);

    await controller.navigateAsync("https://old.example/");

    expect([asked, states, controller.status.refusedOrigin, controller.status.failureReason]).toEqual([["https://new.example/ https://new.example"], [PaneState.Loading, PaneState.Loaded], null, null]);
    stop();
    await controller.navigateAsync("https://old.example/");

    expect([asked.length, controller.status.state, controller.status.refusedOrigin, controller.status.failureReason]).toEqual([1, PaneState.Refused, "https://new.example", null]);
    view.emit(new ViewLoadFailureEvent("https://new.example/", -105, "ERR_NAME_NOT_RESOLVED"));
    expect([controller.status.state, controller.status.failureReason]).toEqual([PaneState.Failed, "ERR_NAME_NOT_RESOLVED"]);
  });

  it("shows the not-allowed page for an origin it is told was refused, and nothing once closed or without a view", async () => {
    const { controller } = open();
    await controller.navigateAsync("https://one.example/");

    controller.refuseNavigation("https://refused.example");
    expect([controller.status.state, controller.status.refusedOrigin, controller.status.url]).toEqual([PaneState.Refused, "https://refused.example", "https://one.example/"]);
    controller.close();
    controller.refuseNavigation("https://other.example");
    const unavailable = new PaneController(null);
    unavailable.refuseNavigation("https://other.example");

    expect([controller.status.refusedOrigin, unavailable.status]).toEqual(["https://refused.example", PaneStatus.unavailable]);
  });

  it("names a refused address whose origin is opaque when it navigates there or reloads it, and the origin alone when it goes back, and the address it is told", async () => {
    const { surface, controller } = open();
    const refusedOrigins: (string | null)[] = [];
    surface.script("about:srcdoc", { kind: "refuse" });
    await controller.navigateAsync("about:srcdoc");
    refusedOrigins.push(controller.status.refusedOrigin);
    await controller.navigateAsync("data:text/html,one");
    await controller.navigateAsync("https://two.example/");
    surface.script("data:text/html,one", { kind: "refuse" });
    await controller.goBackAsync();
    refusedOrigins.push(controller.status.refusedOrigin);
    await controller.navigateAsync("data:text/html,three");
    surface.script("data:text/html,three", { kind: "refuse" });
    await controller.reloadAsync();
    refusedOrigins.push(controller.status.refusedOrigin);
    controller.refuseNavigation("null", "about:srcdoc");
    refusedOrigins.push(controller.status.refusedOrigin);

    expect(refusedOrigins).toEqual(["about:srcdoc", "null", "data:text/html,three", "about:srcdoc"]);
  });

  it("follows no navigation once closed or without a view, and tells no listener", async () => {
    const { controller } = open();
    await controller.navigateAsync("https://one.example/");
    const before: PaneStatus = controller.status;
    const unavailable = new PaneController(null);
    const states: string[] = [];
    unavailable.onChange(t => states.push(t.state));

    controller.close();
    controller.followNavigation();
    unavailable.followNavigation();

    expect([controller.status, unavailable.status, states]).toEqual([before, PaneStatus.unavailable, []]);
  });

  it("is unavailable once the host closes the view, tells its listeners, and refuses to navigate", async () => {
    const { view, controller } = open();
    const states: string[] = [];
    controller.onChange(t => states.push(t.state));

    view.emit(new ViewCloseEvent());

    expect(controller.status).toBe(PaneStatus.unavailable);
    expect(states).toEqual([PaneState.Unavailable]);
    await expect(controller.navigateAsync("https://one.example/")).rejects.toBeInstanceOf(PaneUnavailableException);
    expect(view.calls).toEqual([]);
  });

  it("tells nothing for an event or an answer that changes nothing shown", async () => {
    const { surface, view, controller } = open();
    surface.script("https://refused.example/", { kind: "refuse" });
    await controller.navigateAsync("https://refused.example/");
    const statuses: PaneStatus[] = [];
    controller.onChange(t => statuses.push(t));

    view.emitOther(WebViewEventKind.Opened, { pane: view.pane.toJson(), profileKey: view.profileKey });
    view.emit(new ViewProfileClearedEvent("workspace-1"));
    await controller.navigateAsync("https://refused.example/");
    controller.dismissRequest();

    expect(controller.status.state).toBe(PaneState.Refused);
    expect(statuses).toEqual([]);
  });

  it("keeps a refused request until it is dismissed, and tells each change", () => {
    const { view, controller } = open();
    const requests: (string | null)[] = [];
    controller.onChange(t => requests.push(t.refusedRequest));

    view.emit(new ViewRequestRefusalEvent(RefusedRequest.NewWindow, "https://one.example"));
    view.emit(new ViewRequestRefusalEvent(RefusedRequest.NewWindow, "https://one.example"));
    controller.dismissRequest();

    expect([requests, controller.status.refusedRequest]).toEqual([[RefusedRequest.NewWindow, null], null]);
  });

  it("keeps a typed address's refusal until it is dismissed or a load starts, and tells each change", async () => {
    const { controller } = open();
    const reasons: (string | null)[] = [];
    controller.onChange(t => reasons.push(t.refusedAddress));

    controller.refuseAddress(TypedAddressRefusal.NotAnAddress);
    controller.refuseAddress(TypedAddressRefusal.NotAnAddress);
    controller.dismissAddress();
    controller.dismissAddress();
    controller.refuseAddress(TypedAddressRefusal.Local);
    await controller.navigateAsync("https://one.example/");

    expect(reasons).toEqual(["NotAnAddress", null, "Local", null, null]);
  });

  it("tells each new window the page asks for to its listeners, and changes nothing shown, until they stop listening or it closes", () => {
    const { view, controller } = open();
    const statuses: PaneStatus[] = [];
    const heard: string[] = [];
    controller.onChange(t => statuses.push(t));
    const stop = controller.onNewWindow(t => heard.push(`${t.address} ${t.hadRecentInput}`));
    controller.onNewWindow(t => heard.push(`also ${t.address}`));

    view.emit(new ViewNewWindowEvent("https://two.example/", true, null));
    stop();
    view.emit(new ViewNewWindowEvent("https://three.example/", false, null));
    controller.close();
    view.emit(new ViewNewWindowEvent("https://four.example/", false, null));

    expect([heard, statuses]).toEqual([["https://two.example/ true", "also https://two.example/", "also https://three.example/"], []]);
  });

  it("tells each key listener of the pane's keys pressed in the page, without a change of status, until it stops listening or the controller closes", () => {
    const { controller, view } = open();
    const statuses: PaneStatus[] = [];
    const heard: string[] = [];
    controller.onChange(t => statuses.push(t));
    const stop = controller.onKey(t => heard.push(t.name));
    controller.onKey(t => heard.push(`also ${t.name}`));

    view.emit(new ViewKeyEvent("reload"));
    stop();
    view.emit(new ViewKeyEvent("newPage"));
    controller.close();
    view.emit(new ViewKeyEvent("reload"));

    expect([heard, statuses]).toEqual([["reload", "also reload", "also newPage"], []]);
  });

  it("offers a pop-up in its status and tells each change, and offers none once closed or without a view", () => {
    const { controller } = open();
    const unavailable: PaneController = new PaneController(null);
    const statuses: PaneStatus[] = [];
    controller.onChange(t => statuses.push(t));

    controller.offerPopup("https://ads.example/", "https://one.example");
    controller.close();
    controller.offerPopup("https://other.example/", null);
    unavailable.offerPopup("https://ads.example/", null);

    expect([statuses.map(t => t.popup), unavailable.status]).toStrictEqual([[new PopupOffer("https://ads.example/", "https://one.example", false)], PaneStatus.unavailable]);
  });

  it("says a request got nothing in its status, in place of a pop-up's notice, once, and says nothing once closed or without a view", () => {
    const { controller } = open();
    const unavailable: PaneController = new PaneController(null);
    const statuses: PaneStatus[] = [];
    controller.offerPopup("https://ads.example/", null);
    controller.onChange(t => statuses.push(t));

    controller.refuseRequest(RefusedRequest.NewWindow);
    controller.refuseRequest(RefusedRequest.NewWindow);
    controller.refuseRequest(RefusedRequest.NewWindow, "https://status.example/");
    controller.close();
    controller.refuseRequest(RefusedRequest.Download);
    unavailable.refuseRequest(RefusedRequest.NewWindow);

    expect([statuses.map(t => [t.refusedRequest, t.refusedTarget, t.popup]), unavailable.status])
      .toEqual([[[RefusedRequest.NewWindow, null, null], [RefusedRequest.NewWindow, "https://status.example/", null]], PaneStatus.unavailable]);
  });

  it("refuses no typed address once closed or without a view", () => {
    const { controller } = open();
    const unavailable: PaneController = new PaneController(null);
    const statuses: PaneStatus[] = [];
    controller.onChange(t => statuses.push(t));

    controller.close();
    controller.refuseAddress(TypedAddressRefusal.NotWeb);
    unavailable.refuseAddress(TypedAddressRefusal.NotWeb);

    expect([statuses, controller.status.refusedAddress, unavailable.status]).toEqual([[], null, PaneStatus.unavailable]);
  });

  it("passes on a call the view refuses", async () => {
    const { view, controller } = open();
    view.failNextCall(new Error("The host refused."));

    await expect(controller.navigateAsync("https://one.example/")).rejects.toThrow("The host refused.");
  });

  it("stops telling a listener that unsubscribed", async () => {
    const { controller } = open();
    const statuses: PaneStatus[] = [];
    const unsubscribe: () => void = controller.onChange(t => statuses.push(t));

    unsubscribe();
    await controller.navigateAsync("https://one.example/");

    expect(statuses).toEqual([]);
  });

  it("closes the view once, and then follows and tells nothing more", async () => {
    const { surface, view, controller } = open();
    surface.script("https://refused.example/", { kind: "refuse" });
    const statuses: PaneStatus[] = [];
    controller.onChange(t => statuses.push(t));
    const answer: Promise<unknown> = controller.navigateAsync("https://refused.example/");

    controller.close();
    controller.close();
    view.emit(new ViewCrashEvent());
    await answer;

    expect(view.isClosed).toBe(true);
    expect(view.calls).toEqual(["navigate https://refused.example/", "close"]);
    expect(controller.status.state).toBe(PaneState.Empty);
    expect(statuses).toEqual([]);
  });

  it("starts at 100% and steps the view's zoom in, out and back, telling each zoom listener once of each change, without a change of status", async () => {
    const { controller, view } = open();
    const statuses: PaneStatus[] = [];
    const heard: number[] = [];
    controller.onChange(t => statuses.push(t));
    const stop = controller.onZoom(t => heard.push(t));
    const factor = controller.zoom;

    const answers: number[] = [await controller.zoomInAsync(), await controller.zoomInAsync(), await controller.zoomOutAsync(), await controller.resetZoomAsync(), await controller.resetZoomAsync()];
    stop();
    await controller.zoomOutAsync();

    expect([factor, answers, heard, controller.zoom, view.calls, statuses])
      .toEqual([1, [1.1, 1.25, 1.1, 1, 1], [1.1, 1.25, 1.1, 1], 0.9, ["zoomIn", "zoomIn", "zoomOut", "setZoom 1", "setZoom 1", "zoomOut"], []]);
  });

  it("searches the view's page, moves through its matches and ends the search, answering what the view found, without a change of status", async () => {
    const { controller, view } = open();
    const statuses: PaneStatus[] = [];
    controller.onChange(t => statuses.push(t));
    let next: IWebViewFound = FakeWebView.found(1, 3);
    view.findAnswer = () => Promise.resolve(next);

    const first: IWebViewFound = await controller.findAsync("plan");
    next = FakeWebView.found(2, 3);
    const second: IWebViewFound = await controller.findNextAsync();
    next = FakeWebView.found(1, 3);
    const third: IWebViewFound = await controller.findPreviousAsync();
    controller.endFind();

    expect([first, second, third, view.calls, statuses])
      .toEqual([FakeWebView.found(1, 3), FakeWebView.found(2, 3), FakeWebView.found(1, 3), ["find plan", "findNext", "findPrevious", "endFind"], []]);
  });

  it("follows the zoom the person sets by Noldova Desktop's keys or wheel through the view's Zoom event, until it closes", () => {
    const { controller, view } = open();
    const heard: number[] = [];
    controller.onZoom(t => heard.push(t));

    view.emit(new ViewZoomEvent(1.5));
    view.emit(new ViewZoomEvent(1.5));
    view.emit(new ViewZoomEvent(0.25));
    controller.close();
    view.emit(new ViewZoomEvent(2));

    expect([heard, controller.zoom, controller.status.state]).toEqual([[1.5, 0.25], 0.25, PaneState.Empty]);
  });

  it("is unavailable without a view, and refuses to navigate, move, reload, stop, zoom or find, ending no search", async () => {
    const controller: PaneController = new PaneController(null);

    expect(controller.status).toBe(PaneStatus.unavailable);
    await expect(controller.navigateAsync("https://one.example/")).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.goBackAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.goForwardAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.reloadAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.stopAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.zoomInAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.zoomOutAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.resetZoomAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.findAsync("plan")).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.findNextAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.findPreviousAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    controller.endFind();
    expect([controller.status, controller.zoom]).toEqual([PaneStatus.unavailable, 1]);
  });

  it("refuses to navigate, move, reload, stop, zoom or find once closed, without calling the closed view", async () => {
    const { view, controller } = open();

    controller.close();

    await expect(controller.navigateAsync("https://one.example/")).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.goBackAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.goForwardAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.reloadAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.stopAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.zoomInAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.zoomOutAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.resetZoomAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.findAsync("plan")).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.findNextAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    await expect(controller.findPreviousAsync()).rejects.toBeInstanceOf(PaneUnavailableException);
    controller.endFind();
    expect(view.calls).toEqual(["close"]);
  });

  it("closes without a view, with nothing to tell", () => {
    const controller: PaneController = new PaneController(null);
    const statuses: PaneStatus[] = [];
    controller.onChange(t => statuses.push(t));

    controller.close();
    controller.close();

    expect(controller.status).toBe(PaneStatus.unavailable);
    expect(statuses).toEqual([]);
  });
});

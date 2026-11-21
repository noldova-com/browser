/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewEventKind } from "@noldova/desktop.protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NavigationWatch } from "../../src/services/navigation-watch.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

describe("NavigationWatch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const HELP: string = "https://shop.test/help";
  const REQUEST: JsonObject = { frameId: "main", reason: "anchorClick", url: HELP, disposition: "currentTab" };

  // A wait that a fake clock lets run out answers false; one that ended before answers true.
  const waitAsync = async (watch: NavigationWatch): Promise<boolean> => {
    const waiting: Promise<boolean> = watch.waitAsync(Date.now() + 1_000, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(1_000);
    return waiting;
  };

  it("ends at once when the page asked for no navigation", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    using watch: NavigationWatch = new NavigationWatch(surface.webViews, "view-1", "main");
    surface.emitProtocolEvent("view-1", "Page.loadEventFired", { timestamp: 1 });

    expect(await watch.waitAsync(Date.now(), new AbortController().signal)).toBe(true);
  });

  it("waits for the load of the navigation the page asked for in its main frame", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    using watch: NavigationWatch = new NavigationWatch(surface.webViews, "view-1", "main");
    surface.emitProtocolEvent("view-1", "Page.frameRequestedNavigation", REQUEST);

    expect(await waitAsync(watch)).toBe(false);
    surface.emitProtocolEvent("view-1", "Page.frameStartedNavigating", { frameId: "main", url: HELP, loaderId: "loader-2", navigationType: "differentDocument" });
    surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: { id: "main", loaderId: "loader-2", url: HELP } });
    surface.emitProtocolEvent("view-1", "Page.loadEventFired", { timestamp: 2 });
    expect(await waitAsync(watch)).toBe(true);
  });

  it("settles its request only once the page asked for the navigation in its main frame", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    using watch: NavigationWatch = new NavigationWatch(surface.webViews, "view-1", "main");
    let isRequested: boolean = false;
    void watch.requested.then(() => {
      isRequested = true;
    });
    surface.emitProtocolEvent("view-1", "Page.frameRequestedNavigation", { ...REQUEST, frameId: "inner" });
    await Promise.resolve();
    const before: boolean = isRequested;

    surface.emitProtocolEvent("view-1", "Page.frameRequestedNavigation", REQUEST);
    await watch.requested;

    expect([before, isRequested]).toEqual([false, true]);
  });

  it("ignores a request of another frame, another view or for a new tab", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const surface: ScriptedViews = new ScriptedViews(["view-1", "view-2"]);
    using watch: NavigationWatch = new NavigationWatch(surface.webViews, "view-1", "main");
    surface.emitProtocolEvent("view-1", "Page.frameRequestedNavigation", { ...REQUEST, frameId: "inner" });
    surface.emitProtocolEvent("view-2", "Page.frameRequestedNavigation", REQUEST);
    surface.emitProtocolEvent("view-1", "Page.frameRequestedNavigation", { ...REQUEST, disposition: "newTab" });

    expect(await watch.waitAsync(Date.now(), new AbortController().signal)).toBe(true);
  });

  it("ends the wait on a move within the document in the main frame after the request", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    using watch: NavigationWatch = new NavigationWatch(surface.webViews, "view-1", "main");
    surface.emitProtocolEvent("view-1", "Page.navigatedWithinDocument", { frameId: "main", url: HELP });
    surface.emitProtocolEvent("view-1", "Page.frameRequestedNavigation", REQUEST);
    surface.emitProtocolEvent("view-1", "Page.navigatedWithinDocument", { frameId: "inner", url: HELP });

    expect(await waitAsync(watch)).toBe(false);
    surface.emitProtocolEvent("view-1", "Page.navigatedWithinDocument", { frameId: "main", url: HELP });
    expect(await waitAsync(watch)).toBe(true);
  });

  it("ends the wait when the main frame stops loading after the requested navigation started, never on the old document's stop", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    using watch: NavigationWatch = new NavigationWatch(surface.webViews, "view-1", "main");
    const started: JsonObject = { frameId: "main", url: HELP, loaderId: "loader-2", navigationType: "differentDocument" };
    surface.emitProtocolEvent("view-1", "Page.frameStartedNavigating", started);
    surface.emitProtocolEvent("view-1", "Page.frameRequestedNavigation", REQUEST);
    surface.emitProtocolEvent("view-1", "Page.frameStoppedLoading", { frameId: "main" });
    surface.emitProtocolEvent("view-1", "Page.frameStartedNavigating", { ...started, frameId: "inner" });
    surface.emitProtocolEvent("view-1", "Page.frameStoppedLoading", { frameId: "main" });

    expect(await waitAsync(watch)).toBe(false);
    surface.emitProtocolEvent("view-1", "Page.frameStartedNavigating", started);
    surface.emitProtocolEvent("view-1", "Page.frameStoppedLoading", { frameId: "inner" });
    expect(await waitAsync(watch)).toBe(false);
    surface.emitProtocolEvent("view-1", "Page.frameStoppedLoading", { frameId: "main" });
    expect(await waitAsync(watch)).toBe(true);
  });

  // Each kind's details, as the protocol requires them.
  const DETAILS: ReadonlyMap<WebViewEventKind, JsonObject> = new Map<WebViewEventKind, JsonObject>([
    [WebViewEventKind.NavigationRefused, { address: HELP, origin: "https://shop.test", isRedirect: false }],
    [WebViewEventKind.Crashed, {}],
    [WebViewEventKind.Closed, {}]
  ]);

  it.each([WebViewEventKind.NavigationRefused, WebViewEventKind.Crashed, WebViewEventKind.Closed])("ends the wait when its view's %s event comes", async (kind: WebViewEventKind) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const surface: ScriptedViews = new ScriptedViews(["view-1", "view-2"]);
    using watch: NavigationWatch = new NavigationWatch(surface.webViews, "view-1", "main");
    surface.emitProtocolEvent("view-1", "Page.frameRequestedNavigation", REQUEST);
    surface.emitViewEvent("view-2", kind, DETAILS.get(kind));
    surface.emitViewEvent("view-1", WebViewEventKind.LoadFailed, { address: HELP, code: -2, description: "net::ERR_FAILED" });

    expect(await waitAsync(watch)).toBe(false);
    surface.emitViewEvent("view-1", kind, DETAILS.get(kind));
    expect(await waitAsync(watch)).toBe(true);
  });

  it("stops listening once disposed", () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const before: readonly number[] = [surface.viewListenerCount, surface.protocolListenerCount];
    const watch: NavigationWatch = new NavigationWatch(surface.webViews, "view-1", "main");

    watch[Symbol.dispose]();

    expect([surface.viewListenerCount, surface.protocolListenerCount]).toEqual(before);
  });
});

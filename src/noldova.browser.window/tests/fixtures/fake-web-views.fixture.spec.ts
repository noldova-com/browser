/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";
import type { IWebViewHandle } from "@noldova/desktop.window";
import { describe, expect, it } from "vitest";

import { ViewEventKind } from "../../src/app/enums/view-event-kind.ts";
import { ViewCrashEvent } from "../../src/app/models/view-crash-event.ts";
import type { ViewEvent } from "../../src/app/models/view-event.ts";
import { ViewLoadFailureEvent } from "../../src/app/models/view-load-failure-event.ts";
import { ViewNewWindowEvent } from "../../src/app/models/view-new-window-event.ts";
import { ViewProfileClearedEvent } from "../../src/app/models/view-profile-cleared-event.ts";
import { ViewRefusalEvent } from "../../src/app/models/view-refusal-event.ts";
import { ViewStateEvent } from "../../src/app/models/view-state-event.ts";
import { WebViewEventReader } from "../../src/app/services/web-view-event-reader.ts";
import { FakeWebView, FakeWebViews, WebViewValues } from "./fake-web-views.fixture.ts";
import { describeWebViewsContract } from "./web-views-contract.fixture.ts";

describeWebViewsContract("FakeWebViews", () => {
  const surface: FakeWebViews = new FakeWebViews();
  surface.script("https://refused.example/", { kind: "refuse" });
  surface.script("https://failing.example/", { kind: "fail", code: -105, description: "ERR_NAME_NOT_RESOLVED" });
  return {
    surface: surface.webViews,
    loadingUrl: "https://one.example/",
    otherLoadingUrl: "https://two.example/",
    refusedUrl: "https://refused.example/",
    failingUrl: "https://failing.example/",
    crash: view => surface.views.find(t => t === view)?.crash(),
    closeFromHost: view => surface.views.find(t => t === view)?.closeFromHost(),
    requestNewWindow: (view, address, hadRecentInput) => surface.views.find(t => t === view)
      ?.emit(new ViewNewWindowEvent(address, hadRecentInput, "https://one.example")),
    openViews: () => surface.views.filter(t => !t.isClosed).length,
    isShown: view => surface.views.find(t => t === view)?.isShown ?? false,
    hostOf: view => surface.views.find(t => t === view && !t.isClosed)?.host ?? null
  };
});

describe("FakeWebViews' scripts", () => {
  function follow(view: FakeWebView): (ViewEvent | null)[] {
    const events: (ViewEvent | null)[] = [];
    view.subscribe(t => events.push(WebViewEventReader.read(t)));
    return events;
  }

  it("records the pane, the profile key and every call", async () => {
    const view: FakeWebView = new FakeWebViews().open("workspace-1", WebViewValues.pane("browser.page", "tab-1"));

    const host: HTMLElement = document.createElement("div");
    view.mount(host);
    view.show();
    view.hide();
    await view.reloadAsync();

    expect(view.pane).toEqual(WebViewValues.pane("browser.page", "tab-1"));
    expect(view.profileKey).toBe("workspace-1");
    expect(view.calls).toEqual(["mount", "show", "hide", "reload"]);
    expect(view.host).toBe(host);
    expect(view.isShown).toBe(false);
  });

  it("follows a scripted redirect with the target's address and title", async () => {
    const surface: FakeWebViews = new FakeWebViews();
    surface.script("https://old.example/", { kind: "redirect", to: "https://new.example/", title: "New" });
    const view: FakeWebView = surface.open("workspace-1");
    const events: (ViewEvent | null)[] = follow(view);

    await view.navigateAsync("https://old.example/");

    expect(events).toEqual([
      new ViewStateEvent("https://old.example/", "", true, false, false),
      new ViewStateEvent("https://new.example/", "New", false, false, false)
    ]);
  });

  it("refuses a redirect to a refused address, whose cancelled request fails as blocked, and the page stays where it was", async () => {
    const surface: FakeWebViews = new FakeWebViews();
    surface.script("https://old.example/", { kind: "redirect", to: "https://refused.example/", title: "" });
    surface.script("https://refused.example/", { kind: "refuse" });
    const view: FakeWebView = surface.open("workspace-1");
    const events: (ViewEvent | null)[] = follow(view);

    expect(await view.navigateAsync("https://old.example/")).toEqual(WebViewValues.started);
    await view.navigateAsync("https://one.example/");
    events.length = 0;
    await view.navigateAsync("https://old.example/");

    expect(events).toEqual([
      new ViewStateEvent("https://old.example/", "", true, false, false),
      new ViewRefusalEvent("https://refused.example/", "https://refused.example", true),
      new ViewLoadFailureEvent("https://refused.example/", -20, "ERR_BLOCKED_BY_CLIENT"),
      new ViewStateEvent("https://one.example/", "", false, false, false)
    ]);
  });

  it("refuses a redirect scripted as refused, to an address that loads when the view goes there itself", async () => {
    const surface: FakeWebViews = new FakeWebViews();
    surface.script("https://old.example/", { kind: "redirect", to: "https://new.example/", title: "", isRefused: true });
    const view: FakeWebView = surface.open("workspace-1");
    const events: (ViewEvent | null)[] = follow(view);

    await view.navigateAsync("https://old.example/");
    expect(events.map(t => t?.kind)).toEqual([ViewEventKind.State, ViewEventKind.NavigationRefused, ViewEventKind.LoadFailed, ViewEventKind.State]);
    await view.navigateAsync("https://new.example/");

    expect(events.at(-1)).toEqual(new ViewStateEvent("https://new.example/", "", false, false, false));
  });

  it("keeps a pending load loading until it is stopped", async () => {
    const surface: FakeWebViews = new FakeWebViews();
    surface.script("https://slow.example/", { kind: "pending" });
    const view: FakeWebView = surface.open("workspace-1");
    const events: (ViewEvent | null)[] = follow(view);

    await view.navigateAsync("https://slow.example/");
    expect(events).toEqual([new ViewStateEvent("https://slow.example/", "", true, false, false)]);
    await view.stopAsync();

    expect(events[events.length - 1]).toEqual(new ViewStateEvent("https://slow.example/", "", false, false, false));
  });

  it("refuses a history entry the script refuses, and answers noHistory past either end", async () => {
    const surface: FakeWebViews = new FakeWebViews();
    const view: FakeWebView = surface.open("workspace-1");
    await view.navigateAsync("https://one.example/");
    await view.navigateAsync("https://two.example/");
    surface.script("https://one.example/", { kind: "refuse" });
    const events: (ViewEvent | null)[] = follow(view);

    expect(await view.goForwardAsync()).toEqual(WebViewValues.noHistory);
    expect(await view.goBackAsync()).toEqual(WebViewValues.refused("https://one.example"));

    expect(events).toEqual([]);
  });

  it("numbers its views, and sends each event as the host's WebViewEvent of that view", () => {
    const surface: FakeWebViews = new FakeWebViews();
    const first: FakeWebView = surface.open("workspace-1");
    const second: FakeWebView = surface.open("workspace-1");
    const sent: WebViewEvent[] = [];
    second.subscribe(t => sent.push(t));

    second.emit(new ViewProfileClearedEvent("workspace-1"));
    second.emitOther(WebViewEventKind.Key, { name: "reload" });

    expect([first.id, second.id]).toEqual(["view-1", "view-2"]);
    expect(sent).toEqual([
      new WebViewEvent("browser", "view-2", WebViewEventKind.ProfileCleared, { profileKey: "workspace-1" }),
      new WebViewEvent("browser", "view-2", WebViewEventKind.Key, { name: "reload" })
    ]);
  });

  it("fills the element it is mounted in, and hides by its visibility, keeping its place and size", () => {
    const view: FakeWebView = new FakeWebViews().open("workspace-1");
    const host: HTMLElement = document.createElement("div");
    host.style.cssText = "position: fixed; left: 10px; top: 20px; width: 300px; height: 200px";
    document.body.append(host);

    view.mount(host);
    view.show();
    const shown: DOMRect = view.element.getBoundingClientRect();
    view.hide();
    const hidden: DOMRect = view.element.getBoundingClientRect();
    host.remove();

    expect([shown.left, shown.top, shown.width, shown.height]).toEqual([10, 20, 300, 200]);
    expect([hidden.left, hidden.top, hidden.width, hidden.height, view.element.checkVisibility({ visibilityProperty: true })])
      .toEqual([10, 20, 300, 200, false]);
  });

  it("opens several views for one pane, each with its own history", async () => {
    const surface: FakeWebViews = new FakeWebViews();
    const first: FakeWebView = surface.open("workspace-1");
    const second: FakeWebView = surface.open("workspace-1");

    await first.navigateAsync("https://one.example/");

    expect([surface.views, await second.goBackAsync(), first.isClosed, second.isClosed]).toEqual([[first, second], WebViewValues.noHistory, false, false]);
  });

  it("crashes on demand, fails the next call once, and refuses the next open once", async () => {
    const surface: FakeWebViews = new FakeWebViews();
    const view: FakeWebView = surface.open("workspace-1");
    const events: (ViewEvent | null)[] = follow(view);

    view.crash();
    view.failNextCall(new Error("The host refused."));
    expect(() => view.show()).toThrow("The host refused.");
    view.show();
    surface.refuseNextOpen(new Error("No more views."));

    expect(events).toEqual([new ViewCrashEvent()]);
    expect(view.calls).toEqual(["show"]);
    await expect(surface.openAsync(WebViewValues.pane("browser.other"), "workspace-2")).rejects.toThrow("No more views.");
    expect((await surface.openAsync(WebViewValues.pane("browser.other"), "workspace-2")) === surface.views[1]).toBe(true);
  });

  it("holds the next open until it is released, and only that one", async () => {
    const surface: FakeWebViews = new FakeWebViews();
    const release: () => void = surface.holdNextOpen();
    const held: IWebViewHandle[] = [];

    const opening: Promise<void> = surface.openAsync(WebViewValues.page, "workspace-1").then(t => {
      held.push(t);
    });
    const next: IWebViewHandle = await surface.openAsync(WebViewValues.page, "workspace-2");

    expect(held.length).toBe(0);
    expect(surface.views.length === 1 && surface.views[0] === next).toBe(true);
    release();
    await opening;
    expect(held.length === 1 && held[0] === surface.views[1]).toBe(true);
  });
});

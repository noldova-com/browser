/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WebViewPane } from "@noldova/desktop.protocol";
import type { IWebViewHandle, IWindowWebViews } from "@noldova/desktop.window";
import { describe, expect, it } from "vitest";

import { ViewEventKind } from "../../src/app/enums/view-event-kind.ts";
import { ViewCloseEvent } from "../../src/app/models/view-close-event.ts";
import { ViewCrashEvent } from "../../src/app/models/view-crash-event.ts";
import type { ViewEvent } from "../../src/app/models/view-event.ts";
import { ViewLoadFailureEvent } from "../../src/app/models/view-load-failure-event.ts";
import { ViewNewWindowEvent } from "../../src/app/models/view-new-window-event.ts";
import { WebViewEventReader } from "../../src/app/services/web-view-event-reader.ts";
import { WebViewValues } from "./fake-web-views.fixture.ts";

export interface IWebViewsHarness {
  readonly surface: IWindowWebViews;
  readonly loadingUrl: string;
  readonly otherLoadingUrl: string;
  readonly refusedUrl: string;
  readonly failingUrl: string;
  crash(view: IWebViewHandle): void;
  closeFromHost(view: IWebViewHandle): void;
  requestNewWindow(view: IWebViewHandle, address: string, hadRecentInput: boolean): void;
  openViews(): number;
  isShown(view: IWebViewHandle): boolean;
  hostOf(view: IWebViewHandle): HTMLElement | null;
}

const PANE: WebViewPane = WebViewValues.page;

async function openFollowingAsync(harness: IWebViewsHarness, isMounted: boolean = true): Promise<{ view: IWebViewHandle; events: (ViewEvent | null)[] }> {
  const view: IWebViewHandle = await harness.surface.openAsync(PANE, "contract-profile");
  if (isMounted)
    view.mount(document.createElement("div"));
  const events: (ViewEvent | null)[] = [];
  view.subscribe(t => events.push(WebViewEventReader.read(t)));
  return { view, events };
}

function last(events: readonly (ViewEvent | null)[]): ViewEvent | null | undefined {
  return events[events.length - 1];
}

export function describeWebViewsContract(name: string, createHarness: () => IWebViewsHarness): void {
  describe(`${name}: the window bridge contract`, () => {
    it("starts loading an allowed address and ends with its state", async () => {
      const harness: IWebViewsHarness = createHarness();
      const { view, events } = await openFollowingAsync(harness);

      expect(await view.navigateAsync(harness.loadingUrl)).toEqual(WebViewValues.started);

      expect(events[0]).toMatchObject({ kind: ViewEventKind.State, isLoading: true });
      expect(last(events)).toMatchObject({ kind: ViewEventKind.State, address: harness.loadingUrl, isLoading: false, canGoBack: false, canGoForward: false });
    });

    it("answers an address the check refuses with its origin, with no load", async () => {
      const harness: IWebViewsHarness = createHarness();
      const { view, events } = await openFollowingAsync(harness);

      expect(await view.navigateAsync(harness.refusedUrl)).toEqual(WebViewValues.refused(new URL(harness.refusedUrl).origin));

      expect(events).toEqual([]);
    });

    it("reports a failed load with its address, the engine's code and a description", async () => {
      const harness: IWebViewsHarness = createHarness();
      const { view, events } = await openFollowingAsync(harness);

      await view.navigateAsync(harness.failingUrl);

      const failure: ViewEvent | null | undefined = events.find(t => t instanceof ViewLoadFailureEvent);
      expect(failure).toMatchObject({ kind: ViewEventKind.LoadFailed, address: harness.failingUrl, code: expect.any(Number) });
      expect(failure instanceof ViewLoadFailureEvent ? failure.description.length : 0).toBeGreaterThan(0);
      expect(last(events)).toMatchObject({ kind: ViewEventKind.State, isLoading: false });
    });

    it("goes back and forward through the history, with what each way allows", async () => {
      const harness: IWebViewsHarness = createHarness();
      const { view, events } = await openFollowingAsync(harness);
      await view.navigateAsync(harness.loadingUrl);
      await view.navigateAsync(harness.otherLoadingUrl);

      expect(await view.goBackAsync()).toEqual(WebViewValues.started);
      expect(last(events)).toMatchObject({ kind: ViewEventKind.State, address: harness.loadingUrl, isLoading: false, canGoBack: false, canGoForward: true });

      expect(await view.goForwardAsync()).toEqual(WebViewValues.started);
      expect(last(events)).toMatchObject({ kind: ViewEventKind.State, address: harness.otherLoadingUrl, isLoading: false, canGoBack: true, canGoForward: false });
    });

    it("answers noHistory before the first page, with no event", async () => {
      const harness: IWebViewsHarness = createHarness();
      const { view, events } = await openFollowingAsync(harness);

      expect(await view.goBackAsync()).toEqual(WebViewValues.noHistory);
      expect(await view.goForwardAsync()).toEqual(WebViewValues.noHistory);
      expect(await view.reloadAsync()).toEqual(WebViewValues.noHistory);
      expect(await view.stopAsync()).toEqual(WebViewValues.noHistory);

      expect(events).toEqual([]);
    });

    it("reloads and stops a loaded page", async () => {
      const harness: IWebViewsHarness = createHarness();
      const { view, events } = await openFollowingAsync(harness);
      await view.navigateAsync(harness.loadingUrl);

      expect(await view.reloadAsync()).toEqual(WebViewValues.started);
      expect(await view.stopAsync()).toEqual(WebViewValues.started);

      expect(last(events)).toMatchObject({ kind: ViewEventKind.State, address: harness.loadingUrl, isLoading: false });
    });

    it("stops sending events to a listener that unsubscribed", async () => {
      const harness: IWebViewsHarness = createHarness();
      const { view } = await openFollowingAsync(harness);
      const events: (ViewEvent | null)[] = [];
      const unsubscribe: () => void = view.subscribe(t => events.push(WebViewEventReader.read(t)));

      unsubscribe();
      unsubscribe();
      await view.navigateAsync(harness.loadingUrl);

      expect(events).toEqual([]);
    });

    it("mounts in an element, shows and hides an open view, without an event", async () => {
      const harness: IWebViewsHarness = createHarness();
      const { view, events } = await openFollowingAsync(harness, false);
      const host: HTMLElement = document.createElement("div");

      expect(harness.hostOf(view)).toBeNull();
      view.mount(host);
      expect(harness.hostOf(view)).toBe(host);
      view.show();
      expect(harness.isShown(view)).toBe(true);
      view.hide();
      expect(harness.isShown(view)).toBe(false);
      expect(events).toEqual([]);
    });

    it("moves to the element of a second mount", async () => {
      const harness: IWebViewsHarness = createHarness();
      const { view } = await openFollowingAsync(harness, false);
      const first: HTMLElement = document.createElement("div");
      const second: HTMLElement = document.createElement("div");

      view.mount(first);
      view.mount(second);

      expect([harness.hostOf(view), first.childElementCount, second.childElementCount]).toEqual([second, 0, 1]);
    });

    it("waits to load an address until the view is first mounted, and refuses its history calls until then", async () => {
      const harness: IWebViewsHarness = createHarness();
      const { view, events } = await openFollowingAsync(harness, false);
      let isLoaded: boolean = false;

      const loading: Promise<unknown> = view.navigateAsync(harness.loadingUrl).then(t => {
        isLoaded = true;
        return t;
      });
      await expect(view.reloadAsync()).rejects.toThrow();
      const before: readonly unknown[] = [isLoaded, events.length];
      view.mount(document.createElement("div"));

      expect([before, await loading]).toEqual([[false, 0], WebViewValues.started]);
    });

    it("ends a navigation that waits for the view's mount refused once the view closes", async () => {
      const harness: IWebViewsHarness = createHarness();
      const { view } = await openFollowingAsync(harness, false);

      const loading: Promise<unknown> = view.navigateAsync(harness.loadingUrl);
      view.close();

      await expect(loading).rejects.toThrow();
    });

    it("reports a crash of the page", async () => {
      const harness: IWebViewsHarness = createHarness();
      const { view, events } = await openFollowingAsync(harness);

      harness.crash(view);

      expect(last(events)).toStrictEqual(new ViewCrashEvent());
    });

    it("answers a crashed page's reload with noHistory, and a navigation brings the page back", async () => {
      const harness: IWebViewsHarness = createHarness();
      const { view, events } = await openFollowingAsync(harness);
      await view.navigateAsync(harness.loadingUrl);
      harness.crash(view);

      expect(await view.reloadAsync()).toEqual(WebViewValues.noHistory);
      expect(await view.navigateAsync(harness.refusedUrl)).toEqual(WebViewValues.refused(new URL(harness.refusedUrl).origin));
      expect(await view.reloadAsync()).toEqual(WebViewValues.noHistory);
      expect(await view.navigateAsync(harness.loadingUrl)).toEqual(WebViewValues.started);
      expect(await view.reloadAsync()).toEqual(WebViewValues.started);

      expect(last(events)).toMatchObject({ kind: ViewEventKind.State, address: harness.loadingUrl, isLoading: false });
    });

    it("gives the handle its id, pane and profile key, and marks it closed once closed", async () => {
      const harness: IWebViewsHarness = createHarness();
      const view: IWebViewHandle = await harness.surface.openAsync(PANE, "contract-profile");

      expect([view.id.trim().length > 0, view.pane.equals(PANE), view.profileKey, view.isClosed]).toEqual([true, true, "contract-profile", false]);
      view.close();
      expect(view.isClosed).toBe(true);
    });

    it("reports closed, with no details, when the host closes the view, then refuses its calls and does nothing on mount, show or hide", async () => {
      const harness: IWebViewsHarness = createHarness();
      const { view, events } = await openFollowingAsync(harness);

      harness.closeFromHost(view);

      expect(events).toStrictEqual([new ViewCloseEvent()]);
      await expect(view.navigateAsync(harness.loadingUrl)).rejects.toThrow();
      const host: HTMLElement = document.createElement("div");
      view.mount(host);
      view.show();
      view.hide();
      expect([harness.hostOf(view), host.childElementCount, harness.isShown(view)]).toEqual([null, 0, false]);
      await expect(view.openLayerAsync(() => Promise.resolve(Object))).rejects.toThrow();
      await expect(harness.surface.openAsync(PANE, "contract-profile")).resolves.toBeDefined();
    });

    it("opens several views for a pane, each with its own events, and closing one leaves the others open", async () => {
      const harness: IWebViewsHarness = createHarness();
      const first = await openFollowingAsync(harness);
      const second = await openFollowingAsync(harness);

      expect(await first.view.navigateAsync(harness.loadingUrl)).toEqual(WebViewValues.started);
      expect([first.events.length > 0, second.events]).toEqual([true, []]);
      first.view.close();

      expect(await second.view.navigateAsync(harness.otherLoadingUrl)).toEqual(WebViewValues.started);
    });

    it("hands a page's new-window request to the pane as an event of its view, with the address, whether a click started it and the frame's origin, and opens no view of its own", async () => {
      const harness: IWebViewsHarness = createHarness();
      const { view, events } = await openFollowingAsync(harness);
      await view.navigateAsync(harness.loadingUrl);
      const origin: string = new URL(harness.loadingUrl).origin;

      harness.requestNewWindow(view, harness.otherLoadingUrl, true);
      harness.requestNewWindow(view, harness.otherLoadingUrl, false);

      expect(events.filter(t => t instanceof ViewNewWindowEvent)).toStrictEqual([
        new ViewNewWindowEvent(harness.otherLoadingUrl, true, origin),
        new ViewNewWindowEvent(harness.otherLoadingUrl, false, origin)
      ]);
      expect(harness.openViews()).toBe(1);
    });

    it("refuses its calls once closed, leaves its element, and a second close, a mount, a show and a hide do nothing", async () => {
      const harness: IWebViewsHarness = createHarness();
      const view: IWebViewHandle = await harness.surface.openAsync(PANE, "contract-profile");
      const host: HTMLElement = document.createElement("div");
      view.mount(host);
      view.show();

      view.close();
      view.close();
      view.mount(host);
      view.show();
      view.hide();

      await expect(view.navigateAsync(harness.loadingUrl)).rejects.toThrow();
      await expect(view.stopAsync()).rejects.toThrow();
      await expect(view.openLayerAsync(() => Promise.resolve(Object))).rejects.toThrow();
      expect([harness.hostOf(view), host.childElementCount, harness.isShown(view)]).toEqual([null, 0, false]);
    });
  });
}

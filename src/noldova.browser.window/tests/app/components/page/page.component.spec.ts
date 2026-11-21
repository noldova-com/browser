/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { BrowserEvents, BrowserMethods } from "@noldova/browser.protocol";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { WebViewEventKind } from "@noldova/desktop.protocol";
import { LinkPlace, WindowPartTokens } from "@noldova/desktop.window";
import { Announcer, DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { PageComponent } from "../../../../src/app/components/page/page.component.ts";
import { PaneState } from "../../../../src/app/enums/pane-state.ts";
import { RefusedRequest } from "../../../../src/app/enums/refused-request.ts";
import { ViewLoadFailureEvent } from "../../../../src/app/models/view-load-failure-event.ts";
import { ViewNewWindowEvent } from "../../../../src/app/models/view-new-window-event.ts";
import { ViewRefusalEvent } from "../../../../src/app/models/view-refusal-event.ts";
import { ViewRequestRefusalEvent } from "../../../../src/app/models/view-request-refusal-event.ts";
import { ViewStateEvent } from "../../../../src/app/models/view-state-event.ts";
import { Pages } from "../../../../src/app/services/pages.ts";
import { AccessibilityTreeFixture } from "../../../fixtures/accessibility-tree.fixture.ts";
import { ContrastFixture } from "../../../fixtures/contrast.fixture.ts";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture.ts";
import { FakeWebView, type FakeWebViews } from "../../../fixtures/fake-web-views.fixture.ts";
import { ForcedColorsFixture } from "../../../fixtures/forced-colors.fixture.ts";
import { LiveRegionFixture } from "../../../fixtures/live-region.fixture.ts";
import { MotionFixture } from "../../../fixtures/motion.fixture.ts";
import { WindowContext } from "../../../fixtures/window-context.fixture.ts";

@Component({
  imports: [PageComponent],
  template: `<button type="button" class="before">Before</button><div class="frame" style="height: 30rem" [style.width.px]="width()">@if (isShown()) {<nol-browser-page [instance]="instance()" />}</div>
    <div class="probe" style="background: var(--nol-panel); border-radius: var(--nol-radius-small)"></div>`
})
class HostComponent {
  public readonly instance: WritableSignal<string> = signal("");
  public readonly isShown: WritableSignal<boolean> = signal(true);
  public readonly width: WritableSignal<number> = signal(640);
}

describe("PageComponent", () => {
  let context: WindowContext;
  let pages: Pages;
  let fixture: ComponentFixture<HostComponent> | null;
  let element: HTMLElement;
  let errors: unknown[];
  let checkedErrors: number;
  let allowed: Error | null;

  function expectErrors(expected: readonly unknown[]): void {
    expect(errors).toEqual(expected);
    checkedErrors = errors.length;
  }

  function surface(): FakeWebViews {
    return context.views;
  }

  function find<T extends HTMLElement = HTMLElement>(selector: string): T {
    const found: T | null = element.querySelector<T>(selector);
    if (found === null)
      throw new Error(`The page has no ${selector}.`);
    return found;
  }

  function field(): HTMLInputElement {
    return find<HTMLInputElement>("input.nol-browser-toolbar-field");
  }

  function button(...names: string[]): HTMLButtonElement {
    const found: HTMLButtonElement | undefined = [...find("nol-browser-toolbar").querySelectorAll<HTMLButtonElement>("button")]
      .find(t => names.includes(t.getAttribute("aria-label") ?? ""));
    if (found === undefined)
      throw new Error(`The toolbar has no ${names.join(" or ")} button.`);
    return found;
  }

  function stateActions(name: string): HTMLButtonElement[] {
    return [...element.querySelectorAll<HTMLButtonElement>(".nol-browser-page-state-action")].filter(t => t.textContent?.trim() === name);
  }

  function stateAction(name: string): HTMLButtonElement {
    const found: HTMLButtonElement | undefined = stateActions(name)[0];
    if (found === undefined)
      throw new Error(`The page's state has no ${name} action.`);
    return found;
  }

  function menuItem(name: string): HTMLButtonElement | undefined {
    return [...document.querySelectorAll<HTMLButtonElement>(".nol-browser-toolbar-menu button")]
      .find(t => t.querySelector(".nol-menu-item-label")?.textContent?.trim() === name);
  }

  function heading(): string | undefined {
    return element.querySelector(".nol-browser-page-state-heading")?.textContent?.trim();
  }

  function notice(): string | undefined {
    return element.querySelector(".nol-browser-request-notice-message")?.textContent?.trim();
  }

  function boundsOf(box: DOMRect): { x: number; y: number; width: number; height: number } {
    return { x: Math.round(box.left), y: Math.round(box.top), width: Math.round(box.width), height: Math.round(box.height) };
  }

  function rem(pixels: number): number {
    return Math.round(pixels / AppearanceFixture.toPixels(1) * 10000) / 10000;
  }

  function requestsOf(method: string): JsonValue[] {
    return context.requests.filter(t => t.method === method).map(t => t.parameters);
  }

  function answerWith(method: string, reply: () => JsonValue): void {
    const answer: (method: string, parameters: JsonValue) => Promise<JsonValue> = context.answerRequest;
    context.answerRequest = (asked: string, parameters: JsonValue) => asked === method ? Promise.resolve(reply()) : answer(asked, parameters);
  }

  function press(target: Element, init: KeyboardEventInit): KeyboardEvent {
    const event: KeyboardEvent = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  function withMod(key: string, code: string, init: KeyboardEventInit = {}): KeyboardEventInit {
    return navigator.platform.startsWith("Mac") ? { key, code, metaKey: true, ...init } : { key, code, ctrlKey: true, ...init };
  }

  async function stableAsync(): Promise<void> {
    await fixture?.whenStable();
  }

  function mount(instance: string, width: number = 640): void {
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.instance.set(instance);
    fixture.componentInstance.width.set(width);
    fixture.autoDetectChanges();
    const native: unknown = fixture.nativeElement;
    if (!(native instanceof HTMLElement))
      throw new Error("The fixture has no element.");
    element = native;
  }

  async function showAsync(instance: string, width: number = 640): Promise<void> {
    mount(instance, width);
    await vi.waitFor(() => expect(element.querySelector("nol-browser-toolbar, nol-browser-page-state")).not.toBeNull());
    await stableAsync();
  }

  async function openAsync(url: string | null = null, width: number = 640): Promise<FakeWebView> {
    await showAsync(pages.open("workspace-1", url), width);
    const view: FakeWebView | undefined = surface().views.at(-1);
    if (view === undefined)
      throw new Error("The page opened no view.");
    return view;
  }

  async function placeAsync(): Promise<FakeWebView> {
    const view: FakeWebView = await openAsync("https://one.example/");
    await vi.waitFor(() => expect(view.isShown).toBe(true));
    return view;
  }

  async function stateAsync(name: typeof PaneState.Failed | typeof PaneState.Refused | typeof PaneState.Crashed): Promise<FakeWebView> {
    const view: FakeWebView = await placeAsync();
    await view.navigateAsync("https://two.example/");
    if (name === PaneState.Failed) {
      surface().script("https://gone.example/", { kind: "fail", code: -105, description: "ERR_NAME_NOT_RESOLVED" });
      await view.navigateAsync("https://gone.example/");
    } else if (name === PaneState.Refused)
      view.emit(new ViewRefusalEvent("https://blocked.example/", "https://blocked.example", false));
    else
      view.crash();
    await stableAsync();
    await vi.waitFor(() => expect(view.isShown).toBe(false));
    return view;
  }

  async function typeAsync(text: string): Promise<void> {
    await userEvent.click(field());
    await userEvent.keyboard(`${text}{Enter}`);
  }

  beforeEach(() => {
    errors = [];
    checkedErrors = 0;
    allowed = null;
    fixture = null;
    context = new WindowContext();
    const answer: (method: string, parameters: JsonValue) => Promise<JsonValue> = context.answerRequest;
    context.answerRequest = (method: string, parameters: JsonValue) => method !== BrowserMethods.allowTypedAddress ? answer(method, parameters)
      : allowed === null ? Promise.resolve({ kind: "Allowed", origin: "https://example.com" }) : Promise.reject(allowed);
    pages = new Pages(context);
    AppearanceFixture.apply();
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } },
        { provide: WindowPartTokens.context, useValue: context }
      ]
    });
  });

  afterEach(async () => {
    try {
      (await AppearanceFixture.parkPointerAsync()).remove();
    }
    finally {
      // Vitest skips Angular's own reset after a hook that rejects, so the next test could not configure its module.
      fixture?.destroy();
      TestBed.resetTestingModule();
      pages.close();
      AppearanceFixture.reset();
    }
    expect(errors.slice(checkedErrors)).toEqual([]);
  });

  it("puts the toolbar above the page area, and the notice above the view's place in it", async () => {
    await openAsync();
    const tags = (parent: Element): string[] => [...parent.children].map(t => t.tagName.toLowerCase());

    expect([tags(find("nol-browser-page")), tags(find(".nol-browser-page-area"))]).toEqual([["nol-browser-toolbar", "div"], ["nol-browser-request-notice", "div"]]);
  });

  for (const mode of [ThemeMode.Light, ThemeMode.Dark]) {
    it(`opens its page at the address it was opened with, over the view's place 0.25rem in from the document's sides and bottom, on the panel, in the ${mode} theme`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const view: FakeWebView = await placeAsync();
      const host = find("nol-browser-page");
      const box = host.getBoundingClientRect();
      const place = find(".nol-browser-page-view");
      const area = place.getBoundingClientRect();
      const probe = getComputedStyle(find(".probe"));

      expect([view.calls[0], view.profileKey, heading()]).toEqual(["navigate https://one.example/", "workspace-1", undefined]);
      expect([rem(area.left - box.left), rem(box.right - area.right), rem(box.bottom - area.bottom), Math.round(area.top - find("nol-browser-toolbar").getBoundingClientRect().bottom)])
        .toEqual([0.25, 0.25, 0.25, 0]);
      expect([getComputedStyle(host).backgroundColor, getComputedStyle(place).borderTopLeftRadius]).toEqual([probe.backgroundColor, probe.borderTopLeftRadius]);
      await vi.waitFor(() => expect(boundsOf(view.element.getBoundingClientRect())).toEqual(boundsOf(area)));
    });
  }

  it("mounts a new page's view in the view's place at once, hidden, and its first address loads only once it is mounted", async () => {
    surface().script("https://slow.example/", { kind: "pending" });

    const view: FakeWebView = await openAsync("https://slow.example/");
    await vi.waitFor(() => expect(view.calls).toContain("navigate https://slow.example/"));

    expect([view.host === find(".nol-browser-page-view"), view.calls.slice(0, 2)]).toEqual([true, ["navigate https://slow.example/", "mount"]]);
  });

  it("starts a page opened without an address in its address field, with the empty state's message and its view mounted hidden", async () => {
    const view: FakeWebView = await openAsync();

    await vi.waitFor(() => expect(document.activeElement).toBe(field()));
    expect([heading(), view.isShown, view.calls]).toEqual(["Type an address to open a page", false, ["mount"]]);
  });

  it("starts a page opened without an address in a pane narrower than 16rem with its field shown across the row and focused", async () => {
    await openAsync(null, AppearanceFixture.toPixels(15.75));

    await vi.waitFor(() => expect(document.activeElement).toBe(field()));
    await stableAsync();
    expect([field().getClientRects().length > 0, button("Back").getClientRects().length]).toEqual([true, 0]);
  });

  it("drives its page from the toolbar", async () => {
    const view: FakeWebView = await placeAsync();
    await view.navigateAsync("https://two.example/");
    await stableAsync();

    button("Back").click();

    await vi.waitFor(() => expect(view.calls).toContain("back"));
  });

  it("shows the state's message in place of the view, and places the view again once its page loads", async () => {
    const view: FakeWebView = await stateAsync(PaneState.Crashed);

    expect(heading()).toBe("This page stopped working");
    await view.navigateAsync("https://one.example/");
    await stableAsync();

    await vi.waitFor(() => expect([heading(), view.isShown]).toEqual([undefined, true]));
    expect(errors).toEqual([]);
  });

  for (const [name, label] of [[PaneState.Failed, "Try again"], [PaneState.Refused, "Back"], [PaneState.Crashed, "Reload"]] as const) {
    it(`moves the focus to Reload before ${label} takes the ${name} page's message away, which then shows the page`, async () => {
      const view: FakeWebView = await stateAsync(name);
      const action = find<HTMLButtonElement>("button.nol-browser-page-state-action");
      action.focus();

      expect(action.textContent?.trim()).toBe(label);
      action.click();
      await stableAsync();

      await vi.waitFor(() => expect([heading(), view.isShown]).toEqual([undefined, true]));
      expect([document.activeElement, errors]).toEqual([button("Reload", "Stop"), []]);
    });
  }

  it("moves the focus to Reload when the message holding it goes because its page loads", async () => {
    const view: FakeWebView = await stateAsync(PaneState.Failed);
    find<HTMLButtonElement>("button.nol-browser-page-state-action").focus();

    await view.navigateAsync("https://one.example/again");
    await stableAsync();

    await vi.waitFor(() => expect([heading(), view.isShown]).toEqual([undefined, true]));
    expect(document.activeElement).toBe(button("Reload", "Stop"));
  });

  it("takes the Tab key through the toolbar, the address field, More, the notice and the message, one stop each", async () => {
    const view: FakeWebView = await stateAsync(PaneState.Failed);
    view.emit(new ViewRequestRefusalEvent(RefusedRequest.Download, "https://gone.example"));
    await stableAsync();
    const stops = [button("Back"), field(), button("More"), find("button.nol-browser-request-notice-action"), find("button.nol-browser-page-state-action")];
    find<HTMLButtonElement>("button.before").focus();
    const forward: Element[] = [];
    const backward: Element[] = [];

    for (let index = 0; index < stops.length; index++) {
      await userEvent.tab();
      forward.push(document.activeElement ?? document.body);
    }
    for (let index = 1; index < stops.length; index++) {
      await userEvent.tab({ shift: true });
      backward.push(document.activeElement ?? document.body);
    }

    expect([forward, backward]).toEqual([stops, stops.slice(0, -1).reverse()]);
  });

  for (const mode of [ThemeMode.Light, ThemeMode.Dark]) {
    it(`shows a refused request at the top of the page area and places the view 0.25rem under it, in the ${mode} theme`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const view: FakeWebView = await placeAsync();
      view.emit(new ViewRequestRefusalEvent(RefusedRequest.Download, "https://one.example"));
      await stableAsync();
      const area = find(".nol-browser-page-area").getBoundingClientRect();
      const bar = find(".nol-browser-request-notice-bar").getBoundingClientRect();
      const place = find(".nol-browser-page-view").getBoundingClientRect();

      expect([Math.round(bar.top - area.top), rem(place.top - bar.bottom), notice()]).toEqual([0, 0.25, `Downloads aren't available in ${WindowContext.appName}'s browser yet.`]);
      await vi.waitFor(() => expect(boundsOf(view.element.getBoundingClientRect())).toEqual(boundsOf(place)));
      expect([view.isShown, errors]).toEqual([true, []]);
    });
  }

  it("opens the page in the external browser from a refused request's notice, through the window part's link call in the system's place, whatever the Links settings say", async () => {
    const view: FakeWebView = await placeAsync();
    view.emit(new ViewRequestRefusalEvent(RefusedRequest.Download, "https://one.example"));
    await stableAsync();

    find<HTMLButtonElement>("button.nol-browser-request-notice-action").click();

    await vi.waitFor(() => expect(context.links).toEqual(["https://one.example/"]));
    expect(context.linkPlaces).toEqual([LinkPlace.System]);
    expect(errors).toEqual([]);
  });

  it("hands a link the window part failed to open from the notice to the error handler", async () => {
    const failure: Error = new Error("No browser.");
    vi.spyOn(context, "openLinkAsync").mockRejectedValue(failure);
    const view: FakeWebView = await placeAsync();
    view.emit(new ViewRequestRefusalEvent(RefusedRequest.Download, "https://one.example"));
    await stableAsync();

    find<HTMLButtonElement>("button.nol-browser-request-notice-action").click();

    await vi.waitFor(() => expectErrors([failure]));
  });

  it("opens a stopped pop-up as a page document of its own in the same workspace, takes the notice away, and moves the focus to Reload", async () => {
    const view: FakeWebView = await placeAsync();
    view.emit(new ViewNewWindowEvent("https://ads.example.com/", false, "https://one.example"));
    await stableAsync();
    const action = find<HTMLButtonElement>("button.nol-browser-request-notice-action");
    action.focus();

    expect([notice(), action.textContent?.trim()]).toEqual(["one.example tried to open a pop-up window and was stopped.", "Open as a tab"]);
    action.click();
    await stableAsync();

    expect([context.opened.at(-1)?.title, notice(), document.activeElement]).toEqual(["https://ads.example.com/", undefined, button("Reload", "Stop")]);
    await pages.showAsync(context.opened.at(-1)?.instance ?? "");
    expect(surface().views.at(-1)?.profileKey).toBe("workspace-1");
  });

  it("moves the focus to Reload when the notice holding it goes with the page's next load", async () => {
    const view: FakeWebView = await placeAsync();
    view.emit(new ViewRequestRefusalEvent(RefusedRequest.Download, "https://one.example"));
    await stableAsync();
    find<HTMLButtonElement>("button.nol-browser-request-notice-action").focus();

    await view.navigateAsync("https://one.example/next");
    await stableAsync();

    expect([notice(), document.activeElement, errors]).toEqual([undefined, button("Reload", "Stop"), []]);
  });

  it("gives the toolbar the window part's link call, which opens the page outside in the system's place, whatever the Links settings say", async () => {
    await placeAsync();

    button("More").click();
    await stableAsync();
    menuItem("Open in external browser")?.click();

    await vi.waitFor(() => expect(context.links).toEqual(["https://one.example/"]));
    expect(context.linkPlaces).toEqual([LinkPlace.System]);
    expect(errors).toEqual([]);
  });

  async function actAsync(state: "Acting" | "Asking" | "Ended", instance: string = context.opened.at(-1)?.instance ?? "", aimed: JsonObject = {}): Promise<void> {
    context.emit(BrowserEvents.pageActivity, { instance, activity: "call-1", agentName: "Scout", action: "Clicking", state, box: null, point: null, refusal: null, isHandedOver: false, ...aimed });
    await stableAsync();
  }

  it("shows the teammate's bar between the toolbar and the page area while its call acts, and places the view under it", async () => {
    const view: FakeWebView = await placeAsync();

    await actAsync("Acting");

    const tags = (parent: Element): string[] => [...parent.children].map(t => t.tagName.toLowerCase());
    const bar: DOMRect = find("nol-browser-agent-bar").getBoundingClientRect();
    const area: DOMRect = find(".nol-browser-page-view").getBoundingClientRect();
    expect([tags(find("nol-browser-page")), [...find(".nol-browser-agent-bar-row").children].map(t => t.textContent?.trim())])
      .toEqual([["nol-browser-toolbar", "nol-browser-agent-bar", "div"], ["smart_toy", "Scout is using this page", "Take over", "Stop teammate"]]);
    expect([Math.round(bar.top - find("nol-browser-toolbar").getBoundingClientRect().bottom), Math.round(area.top - bar.bottom)]).toEqual([0, 0]);
    await vi.waitFor(() => expect(boundsOf(view.element.getBoundingClientRect())).toEqual(boundsOf(area)));
  });

  it("takes the bar away when the call ends, and shows none for another page's call", async () => {
    await placeAsync();
    await actAsync("Asking");
    expect(find("nol-browser-agent-bar").textContent).toContain("is waiting for your answer");

    await actAsync("Ended");
    await actAsync("Acting", "4a1c7e2b-9d3f-4e8a-b6c5-0f1e2d3c4b5a");

    expect(element.querySelector("nol-browser-agent-bar")).toBeNull();
  });

  it("stops the teammate's calls on the page from the bar's Stop, and takes the page over from its Take over", async () => {
    await placeAsync();
    await actAsync("Acting");
    const instance: string = context.opened.at(-1)?.instance ?? "";

    find<HTMLButtonElement>(".nol-browser-agent-bar-action:last-child").click();
    find<HTMLButtonElement>(".nol-browser-agent-bar-action:first-of-type").click();

    expect(requestsOf(BrowserMethods.stopPage)).toEqual([{ instance, isTakingOver: false }, { instance, isTakingOver: true }]);
  });

  it("takes the Tab key from More through the bar's Take over and Stop, one stop each, and back", async () => {
    await placeAsync();
    await actAsync("Acting");
    const [takeOver, stop] = [...element.querySelectorAll<HTMLButtonElement>(".nol-browser-agent-bar-action")];
    button("More").focus();
    const order: Element[] = [];

    for (let index = 0; index < 2; index++) {
      await userEvent.tab();
      order.push(document.activeElement ?? document.body);
    }
    await userEvent.tab({ shift: true });
    order.push(document.activeElement ?? document.body);

    expect(order).toEqual([takeOver, stop, takeOver]);
  });

  for (const state of ["Asking", "Ended"] as const) {
    it(`moves the focus from the bar's Stop to Reload when the call ${state === "Asking" ? "starts asking" : "ends"}, and leaves a focus elsewhere alone`, async () => {
      await placeAsync();
      await actAsync("Acting");
      [...element.querySelectorAll<HTMLButtonElement>(".nol-browser-agent-bar-action")].at(-1)?.focus();

      await actAsync(state);

      expect(document.activeElement).toBe(button("Reload", "Stop"));
      await actAsync("Acting");
      field().focus();
      await actAsync(state);
      expect(document.activeElement).toBe(field());
    });
  }

  it("marks a click's element over the live page in the view's layer while the call acts or asks, keeps the bar, and closes the layer at its end", async () => {
    const view: FakeWebView = await placeAsync();
    const box: JsonObject = { x: 40, y: 30, width: 120, height: 24 };

    await actAsync("Acting", undefined, { box });
    await vi.waitFor(() => expect(view.layerElement?.querySelector(".nol-browser-agent-mark-text")?.textContent?.trim()).toBe("Scout · clicking"));
    await actAsync("Asking", undefined, { box });

    await vi.waitFor(() => expect(view.layerElement?.querySelector(".nol-browser-agent-mark-text")?.textContent?.trim()).toBe("Scout · waiting for your answer"));
    const rem: number = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    await vi.waitFor(() => {
      const ring: DOMRect | undefined = view.layerElement?.querySelector(".nol-browser-agent-mark-ring")?.getBoundingClientRect();
      const area: DOMRect = find(".nol-browser-page-view").getBoundingClientRect();
      expect(ring === undefined ? null : [ring.left - area.left, ring.top - area.top]).toEqual([40 - rem / 4, 30 - rem / 4]);
    });
    const marks: NodeListOf<Element> = element.querySelectorAll("nol-browser-agent-mark");
    expect([view.layersOpened, marks.length, view.layerElement?.contains(marks.item(0)), element.querySelector("nol-browser-agent-bar") !== null])
      .toEqual([1, 1, true, true]);
    await actAsync("Ended", undefined, { box });
    expect(view.layerElement).toBeNull();
  });

  it("draws the mark at the view's zoom, from the page's pixels, and follows a zoom while it shows", async () => {
    const view: FakeWebView = await placeAsync();
    await view.setZoomAsync(1.5);
    await stableAsync();
    const box: JsonObject = { x: 40, y: 30, width: 120, height: 24 };
    const rem: number = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const ring = (): readonly number[] | null => {
      const drawn: DOMRect | undefined = view.layerElement?.querySelector(".nol-browser-agent-mark-ring")?.getBoundingClientRect();
      const area: DOMRect = find(".nol-browser-page-view").getBoundingClientRect();
      return drawn === undefined ? null : [drawn.left - area.left, drawn.top - area.top, drawn.width, drawn.height];
    };

    await actAsync("Acting", undefined, { box });
    await vi.waitFor(() => expect(ring()).toEqual([60 - rem / 4, 45 - rem / 4, 180 + rem / 2, 36 + rem / 2]));
    await view.setZoomAsync(1);
    await stableAsync();

    await vi.waitFor(() => expect(ring()).toEqual([40 - rem / 4, 30 - rem / 4, 120 + rem / 2, 24 + rem / 2]));
    await actAsync("Ended", undefined, { box });
  });

  it("gives the error handler a layer that fails to open, and shows the bar without a mark", async () => {
    const view: FakeWebView = await placeAsync();
    const failure: Error = new Error("The mark didn't load.");
    view.layerFailure = failure;

    await actAsync("Acting", undefined, { box: { x: 40, y: 30, width: 120, height: 24 } });

    await vi.waitFor(() => expectErrors([failure]));
    expect([view.layerElement, element.querySelector("nol-browser-agent-bar") !== null]).toEqual([null, true]);
  });

  it("leaves the page live for a longer call or an element with no box, with the bar alone", async () => {
    const view: FakeWebView = await placeAsync();

    await actAsync("Acting", undefined, { action: "Waiting", box: { x: 0, y: 0, width: 10, height: 10 } });
    await actAsync("Acting", undefined, { action: "Typing" });

    expect([element.querySelector("nol-browser-agent-mark"), view.isShown, element.querySelector("nol-browser-agent-bar") !== null]).toEqual([null, true, true]);
  });

  function expectOverView(overlay: Element, view: FakeWebView): void {
    const box: DOMRect = overlay.getBoundingClientRect();
    const page: DOMRect = view.element.getBoundingClientRect();
    const left: number = Math.max(box.left, page.left);
    const right: number = Math.min(box.right, page.right);
    const top: number = Math.max(box.top, page.top);
    const bottom: number = Math.min(box.bottom, page.bottom);
    const hit: Element | null = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);

    expect([right > left && bottom > top, hit !== null && overlay.contains(hit), view.isShown, view.element.checkVisibility({ visibilityProperty: true })])
      .toEqual([true, true, true, true]);
  }

  it("keeps the bar and the mark while the module's menu lies over the live page", async () => {
    const view: FakeWebView = await placeAsync();
    await actAsync("Acting", undefined, { box: { x: 40, y: 30, width: 120, height: 24 } });
    await vi.waitFor(() => expect(document.querySelector("nol-browser-agent-mark")).not.toBeNull());

    button("More").click();
    await stableAsync();
    const menu: Element = await vi.waitFor(() => {
      const found: Element | null = document.querySelector(".nol-browser-toolbar-menu");
      expect(found).not.toBeNull();
      return found ?? document.body;
    });

    expectOverView(menu, view);
    expect([element.querySelector("nol-browser-agent-bar") !== null, document.querySelector("nol-browser-agent-mark") !== null]).toEqual([true, true]);
    await userEvent.keyboard("{Escape}");
    await stableAsync();
  });

  async function askToClearAsync(): Promise<HTMLElement> {
    button("More").click();
    await stableAsync();
    menuItem("Clear browsing data…")?.click();
    await stableAsync();
    return vi.waitFor(() => {
      const dialog: HTMLElement | null = document.querySelector<HTMLElement>("nol-browser-clear-data-dialog");
      expect(dialog).not.toBeNull();
      return dialog ?? document.body;
    });
  }

  function dialogButton(dialog: HTMLElement, name: "clear" | "cancel"): HTMLButtonElement {
    const found: HTMLButtonElement | null = dialog.querySelector<HTMLButtonElement>(`button.nol-browser-clear-data-${name}`);
    if (found === null)
      throw new Error(`The dialog has no ${name} button.`);
    return found;
  }

  function dialogPart(dialog: HTMLElement, selector: string): HTMLElement {
    const found: HTMLElement | null = dialog.querySelector<HTMLElement>(selector);
    if (found === null)
      throw new Error(`The dialog has no ${selector}.`);
    return found;
  }

  it("asks before it clears the workspace's browsing data, over the live page, with the focus on Cancel, and clears it on Clear", async () => {
    const view: FakeWebView = await placeAsync();

    const dialog: HTMLElement = await askToClearAsync();

    await vi.waitFor(() => expect(document.activeElement).toBe(dialogButton(dialog, "cancel")));
    expectOverView(dialogPart(dialog, "nol-dialog"), view);
    expect([dialog.querySelector("[nolDialogDescription]")?.textContent?.trim(), requestsOf(BrowserMethods.clearBrowsingData)]).toEqual([
      "Sites opened in this workspace forget it: their cookies, sign-ins and stored data are removed, and you sign in to them again.", []
    ]);
    dialogButton(dialog, "clear").click();
    await stableAsync();

    await vi.waitFor(() => expect(requestsOf(BrowserMethods.clearBrowsingData)).toEqual([{ profileKey: "workspace-1" }]));
    expect([document.querySelector("nol-browser-clear-data-dialog"), view.isShown, errors]).toEqual([null, true, []]);
  });

  it("keeps Clear before Cancel on one row in the Clear browsing data dialog under forced colours", async () => {
    await placeAsync();
    const dialog: HTMLElement = await askToClearAsync();
    await ForcedColorsFixture.activateAsync();
    try {
      const clear: DOMRect = dialogButton(dialog, "clear").getBoundingClientRect();
      const cancel: DOMRect = dialogButton(dialog, "cancel").getBoundingClientRect();

      expect([clear.right <= cancel.left, Math.round(clear.top - cancel.top)]).toEqual([true, 0]);
    }
    finally {
      await ForcedColorsFixture.resetAsync();
      dialogButton(dialog, "cancel").click();
      await stableAsync();
    }
  });

  it("clears nothing on Cancel or Escape, and leaves the page shown", async () => {
    const view: FakeWebView = await placeAsync();

    dialogButton(await askToClearAsync(), "cancel").click();
    await stableAsync();
    await askToClearAsync();
    await userEvent.keyboard("{Escape}");
    await stableAsync();

    await vi.waitFor(() => expect(document.querySelector("nol-browser-clear-data-dialog")).toBeNull());
    expect([requestsOf(BrowserMethods.clearBrowsingData), view.isShown, errors]).toEqual([[], true, []]);
  });

  it("hands a clear that failed to the error handler", async () => {
    await placeAsync();
    const failure: Error = new Error("The profile is in use.");
    context.answerRequest = () => Promise.reject(failure);

    dialogButton(await askToClearAsync(), "clear").click();

    await vi.waitFor(() => expectErrors([failure]));
  });

  it("closes the dialog with the page's document", async () => {
    const view: FakeWebView = await placeAsync();
    await askToClearAsync();

    fixture?.componentInstance.isShown.set(false);
    await stableAsync();

    await vi.waitFor(() => expect(document.querySelector("nol-browser-clear-data-dialog")).toBeNull());
    expect([requestsOf(BrowserMethods.clearBrowsingData), view.isClosed, errors]).toEqual([[], true, []]);
  });

  async function refuseAsync(): Promise<void> {
    const instance: string = context.opened.at(-1)?.instance ?? "";
    const navigating: JsonObject = { instance, activity: "call-1", agentName: "Scout", action: "Navigating", state: "Acting", box: null, point: null, refusal: null, isHandedOver: false };
    context.emit(BrowserEvents.pageActivity, navigating);
    context.emit(BrowserEvents.pageActivity, { ...navigating, state: "Ended", refusal: { url: "https://example.com/pricing", origin: "https://example.com" } });
    await stableAsync();
  }

  it("leaves the page a teammate couldn't open in the view's place, and opens its address as the person's own once they allow it", async () => {
    const view: FakeWebView = await placeAsync();

    await refuseAsync();
    await vi.waitFor(() => expect(view.isShown).toBe(false));
    expect([find(".nol-browser-page-state-heading").textContent?.trim(), field().value]).toEqual(["Scout can't open example.com", "https://example.com/pricing"]);
    stateAction("Allow this site for the workspace").click();

    await vi.waitFor(() => expect(view.calls.filter(t => t.startsWith("navigate")).at(-1)).toBe("navigate https://example.com/pricing"));
    expect([requestsOf(BrowserMethods.allowTypedAddress), element.querySelector(".nol-browser-page-state")]).toEqual([
      [{ profileKey: "workspace-1", url: "https://example.com/pricing", instance: expect.any(String) }], null
    ]);
  });

  it("gives the page back as it was on Not now, with the focus on the toolbar, and allows nothing", async () => {
    const view: FakeWebView = await placeAsync();
    await refuseAsync();

    stateAction("Not now").click();

    await vi.waitFor(() => expect(view.isShown).toBe(true));
    expect([requestsOf(BrowserMethods.allowTypedAddress), element.querySelector(".nol-browser-page-state"), document.activeElement?.closest("nol-browser-toolbar") !== null, field().value])
      .toEqual([[], null, true, "https://one.example/"]);
  });

  it("goes to an address typed in the toolbar once the runtime part allowed it in the page's workspace", async () => {
    const view: FakeWebView = await openAsync();

    await typeAsync("example.com/docs");

    await vi.waitFor(() => expect(field().value).toBe("https://example.com/docs"));
    expect([requestsOf(BrowserMethods.allowTypedAddress), view.calls.filter(t => t.startsWith("navigate"))]).toEqual([
      [{ profileKey: "workspace-1", url: "https://example.com/docs", instance: expect.any(String) }], ["navigate https://example.com/docs"]
    ]);
  });

  it("keeps the typed text in the field, marked invalid and described by the refused page's heading, when Noldova Desktop refuses its navigation", async () => {
    const view: FakeWebView = await openAsync();
    surface().script("https://example.com/docs", { kind: "refuse" });

    await typeAsync("example.com/docs");
    await vi.waitFor(() => expect(view.calls).toEqual(["mount", "navigate https://example.com/docs"]));
    await stableAsync();

    expect([field().value, field().getAttribute("aria-invalid"), document.getElementById(field().getAttribute("aria-describedby") ?? "")?.textContent?.trim()])
      .toEqual(["example.com/docs", "true", heading()]);
    expect(heading()).toContain("example.com");
  });

  it("marks no address entered over a refused page while its answer is held, nor once its navigation starts", async () => {
    const view: FakeWebView = await openAsync();
    surface().script("https://refused.example/", { kind: "refuse" });
    surface().script("https://fixed.example/", { kind: "pending" });
    await typeAsync("refused.example");
    await vi.waitFor(() => expect(field().getAttribute("aria-invalid")).toBe("true"));
    const refusal: string | undefined = heading();
    const answer: (method: string, parameters: JsonValue) => Promise<JsonValue> = context.answerRequest;
    let allow: (value: JsonValue) => void = () => undefined;
    context.answerRequest = (method: string, parameters: JsonValue) => method !== BrowserMethods.allowTypedAddress ? answer(method, parameters)
      : new Promise<JsonValue>(resolve => {
        allow = resolve;
      });

    await userEvent.clear(field());
    await typeAsync("fixed.example");
    await vi.waitFor(() => expect(requestsOf(BrowserMethods.allowTypedAddress)).toHaveLength(2));
    await stableAsync();
    const held: [string, string | null, string | undefined] = [field().value, field().getAttribute("aria-invalid"), heading()];
    allow({ kind: "Allowed", origin: "https://fixed.example" });
    await vi.waitFor(() => expect(view.calls).toContain("navigate https://fixed.example/"));
    await stableAsync();

    expect(refusal).toContain("refused.example");
    expect(held).toEqual(["fixed.example", null, refusal]);
    expect(field().getAttribute("aria-invalid")).toBeNull();
  });

  it("goes nowhere once Escape leaves an entered address that still waits for its answer", async () => {
    const view: FakeWebView = await placeAsync();
    const answer: (method: string, parameters: JsonValue) => Promise<JsonValue> = context.answerRequest;
    let allow: (value: JsonValue) => void = () => undefined;
    context.answerRequest = (method: string, parameters: JsonValue) => method !== BrowserMethods.allowTypedAddress ? answer(method, parameters)
      : new Promise<JsonValue>(resolve => {
        allow = resolve;
      });

    await typeAsync("two.example");
    await vi.waitFor(() => expect(requestsOf(BrowserMethods.allowTypedAddress)).toHaveLength(1));
    await userEvent.keyboard("{Escape}");
    allow({ kind: "Allowed", origin: "https://two.example" });
    await stableAsync();

    expect([view.calls.filter(t => t.startsWith("navigate")), field().value]).toEqual([["navigate https://one.example/"], "https://one.example/"]);
  });

  it("goes nowhere once the failed page's own Try again leaves an entered address that still waits for its answer, and puts the page's address back", async () => {
    const view: FakeWebView = await stateAsync(PaneState.Failed);
    const answer: (method: string, parameters: JsonValue) => Promise<JsonValue> = context.answerRequest;
    let allow: (value: JsonValue) => void = () => undefined;
    context.answerRequest = (method: string, parameters: JsonValue) => method !== BrowserMethods.allowTypedAddress ? answer(method, parameters)
      : new Promise<JsonValue>(resolve => {
        allow = resolve;
      });

    await userEvent.click(field());
    field().select();
    await userEvent.keyboard("three.example{Enter}");
    await vi.waitFor(() => expect(requestsOf(BrowserMethods.allowTypedAddress)).toHaveLength(1));
    const entered: string = field().value;
    stateAction("Try again").click();
    await vi.waitFor(() => expect(field().value).not.toBe(entered));
    allow({ kind: "Allowed", origin: "https://three.example" });
    await stableAsync();

    expect([entered, view.calls.filter(t => t === "reload" || t === "navigate https://three.example/"), field().value]).toEqual(["three.example", ["reload"], "https://two.example/"]);
  });

  it("says why it didn't go to typed text that isn't an address, at the top of the page area, and names the notice as the field's description", async () => {
    await openAsync();

    await typeAsync("release notes");

    await vi.waitFor(() => expect(notice()).toBe("Type a web address, such as example.com."));
    expect([requestsOf(BrowserMethods.allowTypedAddress), field().value, field().getAttribute("aria-invalid")]).toEqual([[], "release notes", "true"]);
    expect(document.getElementById(field().getAttribute("aria-describedby") ?? "")?.textContent?.trim()).toBe("Type a web address, such as example.com.");
  });

  it("says the address couldn't be allowed, marks the field and hands the failure to the error handler when the runtime part's request fails", async () => {
    const view: FakeWebView = await openAsync();
    allowed = new Error("The store is closed.");

    await typeAsync("example.com");

    await vi.waitFor(() => expectErrors([allowed]));
    expect([notice(), field().value, field().getAttribute("aria-invalid"), view.calls]).toEqual([
      `${WindowContext.appName}'s browser couldn't allow this address's site in the workspace. Try again.`, "example.com", "true", ["mount"]
    ]);
  });

  it("keeps a failed load's state for typed text that isn't an address, and puts the refused state of a typed address the runtime part refuses in its place, so the page and its field name one address", async () => {
    await stateAsync(PaneState.Failed);
    refuseTyped("Local");

    await typeAsync("release notes");
    await vi.waitFor(() => expect(notice()).toBe("Type a web address, such as example.com."));
    expect(heading()).toBe("Can't reach gone.example");
    await userEvent.clear(field());
    await typeAsync("http://192.168.1.1");

    await vi.waitFor(() => expect(heading()).toBe(`${WindowContext.appName}'s browser doesn't open http://192.168.1.1`));
    expect([field().value, field().getAttribute("aria-invalid"), notice()]).toEqual(["http://192.168.1.1", "true",
      `${WindowContext.appName}'s browser opens an address on this computer or its network only once Settings names its site, under Sites on this computer or network.`]);
    expect(await AccessibilityTreeFixture.readAsync(find(".nol-browser-page-view"))).toEqual([
      `heading "${WindowContext.appName}'s browser doesn't open http://192.168.1.1" level=2`,
      "paragraph",
      `  StaticText "Its address isn't one ${WindowContext.appName}'s browser opens."`,
      "button \"Back\""
    ]);
  });

  function refuseTyped(reason: string): void {
    answerWith(BrowserMethods.allowTypedAddress, () => ({ kind: "Refused", reason }));
  }

  it("puts the failed load's state back with Try again, and its address in the field, when Escape dismisses a refused address's notice", async () => {
    await stateAsync(PaneState.Failed);
    refuseTyped("Local");
    await userEvent.clear(field());
    await typeAsync("http://192.168.1.1");
    await vi.waitFor(() => expect(heading()).toBe(`${WindowContext.appName}'s browser doesn't open http://192.168.1.1`));

    await userEvent.keyboard("{Escape}");

    await vi.waitFor(() => expect(heading()).toBe("Can't reach gone.example"));
    expect([field().value, notice(), stateActions("Try again").length]).toEqual(["https://gone.example/", undefined, 1]);
  });

  it.each<[string, string]>([
    ["Credentials", "https://user:hunter2@example.com/"],
    ["TooLong", `https://example.com/${"a".repeat(64)}`]
  ])("heads a %s refusal with the address, never the origin, so no user name or password shows in the heading or the announcement", async (reason: string, address: string) => {
    await stateAsync(PaneState.Failed);
    refuseTyped(reason);
    const said: string[] = [];
    const announcer: Announcer = TestBed.inject(Announcer);
    const announce = announcer.announce.bind(announcer);
    vi.spyOn(announcer, "announce").mockImplementation((message, politeness, options) => {
      said.push(message);
      announce(message, politeness, options);
    });

    await userEvent.clear(field());
    await typeAsync(address);

    await vi.waitFor(() => expect([heading(), said.includes(`${WindowContext.appName}'s browser doesn't open this address`)]).toEqual([`${WindowContext.appName}'s browser doesn't open this address`, true]));
    expect([said.join(" "), find(".nol-browser-page-view").textContent]).toEqual([expect.not.stringMatching(/hunter2|user:|example\.com/u),
      expect.not.stringMatching(/hunter2|user:|example\.com/u)]);
  });

  it("puts a refused address's state in place of a failed load's with no history, keeping the focus in the field, and with no Back", async () => {
    surface().script("https://gone.example/", { kind: "fail", code: -105, description: "ERR_NAME_NOT_RESOLVED" });
    await openAsync("https://gone.example/");
    await vi.waitFor(() => expect(heading()).toBe("Can't reach gone.example"));
    refuseTyped("NeverAllowed");

    await userEvent.clear(field());
    await typeAsync("http://192.168.1.1");

    await vi.waitFor(() => expect(heading()).toBe(`${WindowContext.appName}'s browser doesn't open http://192.168.1.1`));
    expect([document.activeElement === field(), await AccessibilityTreeFixture.readAsync(find(".nol-browser-page-view"))]).toEqual([true, [
      `heading "${WindowContext.appName}'s browser doesn't open http://192.168.1.1" level=2`,
      "paragraph",
      `  StaticText "Its address isn't one ${WindowContext.appName}'s browser opens."`
    ]]);
  });

  it("puts a refused address's state for another origin in place of a refused navigation's, and Escape brings the navigation's back", async () => {
    await stateAsync(PaneState.Refused);
    expect(heading()).toBe("This workspace doesn't allow https://blocked.example");
    refuseTyped("Local");

    await userEvent.clear(field());
    await typeAsync("http://192.168.1.1");
    await vi.waitFor(() => expect(heading()).toBe(`${WindowContext.appName}'s browser doesn't open http://192.168.1.1`));
    await userEvent.keyboard("{Escape}");

    await vi.waitFor(() => expect(heading()).toBe("This workspace doesn't allow https://blocked.example"));
  });

  it("has the announcer's live region from its first render, so the page's first message is spoken into a region that was already there", async () => {
    const instance: string = pages.open("workspace-1", null);
    const hold: () => void = surface().holdNextOpen();
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.instance.set(instance);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const region = LiveRegionFixture.region();
    const spoken = LiveRegionFixture.spokenAsync();

    hold();

    expect([region === null, await spoken, LiveRegionFixture.region() === region]).toEqual([false, "Type an address to open a page", true]);
  });

  it("marks the page area busy while its page loads, until it loads or fails", async () => {
    const view: FakeWebView = await placeAsync();
    const busy = (): string | null => find(".nol-browser-page-area").getAttribute("aria-busy");
    const seen: (string | null)[] = [busy()];

    view.emit(new ViewStateEvent("https://two.example/", "Two", true, true, false));
    await stableAsync();
    seen.push(busy());
    view.emit(new ViewLoadFailureEvent("https://two.example/", -105, "ERR_NAME_NOT_RESOLVED"));
    view.emit(new ViewStateEvent("https://two.example/", "Two", false, true, false));
    await stableAsync();
    seen.push(busy());

    expect(seen).toEqual([null, "true", null]);
  });

  it("gives every control its role, name and states in the accessibility tree", async () => {
    const view: FakeWebView = await openAsync();
    view.emit(new ViewStateEvent("http://one.example/", "One", true, true, false));
    view.emit(new ViewRequestRefusalEvent(RefusedRequest.Download, "http://one.example"));
    await stableAsync();

    expect(await AccessibilityTreeFixture.readAsync(find("nol-browser-page"))).toEqual([
      "toolbar \"Page\"",
      "  button \"Back\"",
      "  button \"Forward\" disabled",
      "  button \"Stop\"",
      "StaticText \"Not secure\"",
      "textbox \"http://one.example/\" description=\"Not secure\" value=\"http://one.example/\"",
      "button \"More\" expanded=false hasPopup=menu",
      "progressbar \"Loading the page\"",
      "paragraph",
      `  StaticText "Downloads aren't available in ${WindowContext.appName}'s browser yet."`,
      "button \"Open in external browser\""
    ]);
  });

  it("names the teammate's bar and its Take over and Stop teammate in the accessibility tree, and drops the buttons while the call asks", async () => {
    await placeAsync();
    await actAsync("Acting");
    const acting: string[] = await AccessibilityTreeFixture.readAsync(find("nol-browser-agent-bar"));
    await actAsync("Asking");
    const asking: string[] = await AccessibilityTreeFixture.readAsync(find("nol-browser-agent-bar"));

    expect([acting.at(0), acting.slice(-2), asking.at(0), asking.some(t => t.includes("button"))])
      .toEqual(["paragraph", ["button \"Take over\"", "button \"Stop teammate\""], "paragraph", false]);
    expect(acting.join("\n")).toContain("Scout");
  });

  it("names the toolbar's Stop and the teammate's Stop teammate apart while a teammate acts on a loading page", async () => {
    const view: FakeWebView = await placeAsync();
    view.emit(new ViewStateEvent("https://one.example/", "One", true, true, false));
    await actAsync("Acting");

    expect([...element.querySelectorAll<HTMLButtonElement>("button")].map(t => t.getAttribute("aria-label") ?? t.textContent?.trim() ?? "").filter(t => t.startsWith("Stop")))
      .toEqual(["Stop", "Stop teammate"]);
  });

  it("puts the state's message in a heading, its detail in a paragraph and its actions in buttons, in the accessibility tree", async () => {
    await stateAsync(PaneState.Failed);

    expect(await AccessibilityTreeFixture.readAsync(find(".nol-browser-page-view"))).toEqual([
      "heading \"Can't reach gone.example\" level=2",
      "paragraph",
      "  StaticText \"The address may be mistyped, or the site is down. The server couldn't be found (DNS).\"",
      "button \"Try again\"",
      "button \"Copy address\""
    ]);
  });

  it("makes no further call to a view the host closed", async () => {
    const view: FakeWebView = await placeAsync();

    view.closeFromHost();
    await stableAsync();

    expect(errors).toEqual([]);
  });

  it("lets go of its view when the document closes, and has the runtime part forget the page", async () => {
    const view: FakeWebView = await placeAsync();
    const instance: string = context.opened[0]?.instance ?? "";

    context.closeByPerson(instance);
    fixture?.componentInstance.isShown.set(false);
    await stableAsync();

    await vi.waitFor(() => expect(requestsOf(BrowserMethods.forgetPage)).toEqual([{ instance }]));
    expect([view.calls.slice(-2), errors]).toEqual([["hide", "close"], []]);
  });

  it("closes the view of a page whose document closed while the view opened", async () => {
    const instance: string = pages.open("workspace-1", "https://one.example/");
    const hold: () => void = surface().holdNextOpen();
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.instance.set(instance);
    fixture.autoDetectChanges();
    await fixture.whenStable();

    fixture.componentInstance.isShown.set(false);
    await fixture.whenStable();
    hold();

    await vi.waitFor(() => expect(surface().views.map(t => t.isClosed)).toEqual([true]));
    expect(errors).toEqual([]);
  });

  it("shows that it can't show pages when the host refused its view, with the toolbar there", async () => {
    surface().refuseNextOpen(new Error("The pane isn't open."));

    await showAsync(pages.open("workspace-1", "https://one.example/"));

    expect([surface().views, element.querySelector("nol-browser-toolbar") !== null, heading()]).toEqual([[], true, `${WindowContext.appName}'s browser can't show pages here`]);
  });

  it("says a restored page it keeps no record of can't open again, without a toolbar, and closes its document on Close", async () => {
    await showAsync("4a1c7e2b-9d3f-4e8a-b6c5-0f1e2d3c4b5a");

    expect([heading(), element.querySelector("nol-browser-toolbar"), surface().views, requestsOf(BrowserMethods.claimPage), errors])
      .toEqual(["This page can't open again", null, [], [{ instance: "4a1c7e2b-9d3f-4e8a-b6c5-0f1e2d3c4b5a" }], []]);
    find<HTMLButtonElement>("button.nol-browser-page-state-action").click();

    expect(context.closed).toEqual(["4a1c7e2b-9d3f-4e8a-b6c5-0f1e2d3c4b5a"]);
  });

  it("says another window has a restored page, without a toolbar or view, and shows the page once this window claims it on an open", async () => {
    const instance: string = "4a1c7e2b-9d3f-4e8a-b6c5-0f1e2d3c4b5a";
    const record = { instance, profileKey: "workspace-2", url: "https://status.example.com/" };
    let isFree: boolean = false;
    answerWith(BrowserMethods.claimPage, () => ({ agentName: null, isClaimed: isFree, isHere: false, record: isFree ? record : null }));
    answerWith(BrowserMethods.readPage, () => record);

    await showAsync(instance);

    expect([heading(), element.querySelector("nol-browser-toolbar"), surface().views, errors]).toEqual(["This page moved to another window", null, [], []]);
    isFree = true;
    await pages.openAsync("workspace-2", null, instance);
    await vi.waitFor(() => expect(surface().views.map(t => [t.profileKey, t.calls[0]])).toEqual([["workspace-2", "navigate https://status.example.com/"]]));
    await vi.waitFor(() => expect(element.querySelector("nol-browser-toolbar")).not.toBeNull());
  });

  it("closes its view and says so when another window took its page while the runtime started again", async () => {
    const instance: string = pages.open("workspace-1", "https://one.example/");
    await showAsync(instance);
    context.openDocuments = [instance];
    answerWith(BrowserMethods.holdPages, () => ({ agents: [], refused: [instance] }));

    await pages.reportOpenAsync();
    await fixture?.whenStable();

    expect([heading(), element.querySelector("nol-browser-toolbar"), surface().views.map(t => t.isClosed)]).toEqual(["This page moved to another window", null, [true]]);
  });

  it("says a restored page whose record the runtime part can't read can't open again, without a toolbar, closes its document on Close, and hands the failure to the error handler", async () => {
    const failure: Error = new Error("The database is closed.");
    context.answerRequest = () => Promise.reject(failure);

    mount("4a1c7e2b-9d3f-4e8a-b6c5-0f1e2d3c4b5a");

    await vi.waitFor(() => expectErrors([failure]));
    await stableAsync();
    expect([heading(), element.querySelector("nol-browser-toolbar"), surface().views]).toEqual(["This page can't open again", null, []]);
    find<HTMLButtonElement>("button.nol-browser-page-state-action").click();

    expect(context.closed).toEqual(["4a1c7e2b-9d3f-4e8a-b6c5-0f1e2d3c4b5a"]);
  });

  it("reopens a restored page in its workspace at its last address", async () => {
    answerWith(BrowserMethods.claimPage,
      () => ({ agentName: null, isClaimed: true, isHere: false, record: { instance: "4a1c7e2b-9d3f-4e8a-b6c5-0f1e2d3c4b5a", profileKey: "workspace-2", url: "https://status.example.com/" } }));

    await showAsync("4a1c7e2b-9d3f-4e8a-b6c5-0f1e2d3c4b5a");

    await vi.waitFor(() => expect(surface().views.map(t => [t.profileKey, t.calls[0]])).toEqual([["workspace-2", "navigate https://status.example.com/"]]));
  });

  it("reloads its page from the reload key Noldova Desktop sends from the page, and from Ctrl+R, or Cmd+R, and F5 but on macOS, in the toolbar and its field", async () => {
    const view: FakeWebView = await placeAsync();
    const isMac: boolean = navigator.platform.startsWith("Mac");

    view.emitOther(WebViewEventKind.Key, { name: "reload" });
    const pressed: boolean[] = [press(button("Back"), withMod("r", "KeyR")), press(field(), withMod("r", "KeyR")), press(button("Back"), { key: "F5", code: "F5" })]
      .map(t => t.defaultPrevented);

    await vi.waitFor(() => expect(view.calls.filter(t => t === "reload")).toHaveLength(isMac ? 3 : 4));
    expect(pressed).toEqual([true, true, !isMac]);
  });

  it("opens an empty page on its workspace at the end of the row from the new page key, in the page and in the toolbar", async () => {
    const view: FakeWebView = await placeAsync();

    view.emitOther(WebViewEventKind.Key, { name: "newPage" });
    const pressed: KeyboardEvent = press(button("Back"), withMod("t", "KeyT"));
    const shown = await pages.showAsync(context.opened.at(-1)?.instance ?? "");

    expect([pressed.defaultPrevented, context.opened.map(t => [t.title, t.after]), shown === null ? null : shown.controller.status.state, surface().views.at(-1)?.profileKey])
      .toEqual([true, [["https://one.example/", null], ["New tab", null], ["New tab", null]], PaneState.Empty, "workspace-1"]);
    expect(view.calls.filter(t => t === "reload")).toEqual([]);
  });

  it("opens an empty page on its workspace beside the page that holds the focus, in its toolbar or its view, when Noldova Desktop runs the new page command from its key, and none while the focus is outside every page", async () => {
    const view: FakeWebView = await placeAsync();
    view.element.tabIndex = -1;

    find(".before").focus();
    const outside: boolean = pages.canOpenBeside(null);
    pages.openBeside(null);
    button("Back").focus();
    const inToolbar: boolean = pages.canOpenBeside(null);
    pages.openBeside(null);
    view.element.focus();
    const inView: boolean = pages.canOpenBeside(null);
    pages.openBeside(null);
    const shown = await pages.showAsync(context.opened.at(-1)?.instance ?? "");

    expect([outside, inToolbar, inView, find("nol-browser-page").getAttribute("data-instance") === context.opened[0]?.instance]).toEqual([false, true, true, true]);
    expect([context.opened.map(t => [t.title, t.after]), shown === null ? null : shown.controller.status.state, surface().views.at(-1)?.profileKey])
      .toEqual([[["https://one.example/", null], ["New tab", null], ["New tab", null]], PaneState.Empty, "workspace-1"]);
  });

  it("stops a loading page from Escape in the toolbar, and not from Escape in the address field, which puts back the page's address, or once it loaded", async () => {
    const view: FakeWebView = await placeAsync();
    view.emit(new ViewStateEvent("https://two.example/", "Two", true, true, false));
    await stableAsync();

    const inField: KeyboardEvent = press(field(), { key: "Escape", code: "Escape" });
    const inToolbar: KeyboardEvent = press(button("Back"), { key: "Escape", code: "Escape" });
    await vi.waitFor(() => expect(view.calls).toContain("stop"));
    view.emit(new ViewStateEvent("https://two.example/", "Two", false, true, false));
    await vi.waitFor(() => expect(find(".nol-browser-page-area").getAttribute("aria-busy")).toBeNull());
    const loaded: KeyboardEvent = press(button("Back"), { key: "Escape", code: "Escape" });

    expect([inField.defaultPrevented, inToolbar.defaultPrevented, loaded.defaultPrevented, view.calls.filter(t => t === "stop")]).toEqual([false, true, false, ["stop"]]);
  });

  it("focuses the address field with its whole address selected from the focus address key, in the page and in the toolbar, ahead of the app's commands", async () => {
    const view: FakeWebView = await placeAsync();
    const selection = (): [boolean, number | null, number | null, number] => [document.activeElement === field(), field().selectionStart, field().selectionEnd, field().value.length];

    view.emitOther(WebViewEventKind.Key, { name: "focusAddress" });
    await stableAsync();
    const fromPage = selection();
    field().setSelectionRange(2, 2);
    const inField: KeyboardEvent = press(field(), withMod("l", "KeyL"));
    const fromField = selection();
    button("Back").focus();
    const inToolbar: KeyboardEvent = press(button("Back"), withMod("l", "KeyL"));
    const length: number = field().value.length;

    expect([fromPage, inField.defaultPrevented, fromField, inToolbar.defaultPrevented, selection()])
      .toEqual([[true, 0, length, length], true, [true, 0, length, length], true, [true, 0, length, length]]);
  });

  function findField(): HTMLInputElement {
    return find<HTMLInputElement>("nol-browser-find-bar input");
  }

  it("opens the find bar between the toolbar and the page area from the find key Noldova Desktop sends from the page, its field focused, and the view's place under it", async () => {
    const view: FakeWebView = await placeAsync();
    const tags = (parent: Element): string[] => [...parent.children].map(t => t.tagName.toLowerCase());

    view.emitOther(WebViewEventKind.Key, { name: "find" });
    await stableAsync();
    await vi.waitFor(() => expect(document.activeElement).toBe(findField()));
    const [toolbar, bar, area] = [find("nol-browser-toolbar"), find("nol-browser-find-bar"), find(".nol-browser-page-view")].map(t => t.getBoundingClientRect());

    expect(tags(find("nol-browser-page"))).toEqual(["nol-browser-toolbar", "nol-browser-find-bar", "div"]);
    expect([Math.round((bar?.top ?? 0) - (toolbar?.bottom ?? 0)), Math.round((area?.top ?? 0) - (bar?.bottom ?? 0))]).toEqual([0, 0]);
    await vi.waitFor(() => expect(boundsOf(view.element.getBoundingClientRect())).toEqual(boundsOf(find(".nol-browser-page-view").getBoundingClientRect())));
  });

  it("opens the find bar from Ctrl+F, or Cmd+F, in the toolbar and from More's Find on page, and selects its text again from the key in its own field", async () => {
    const view: FakeWebView = await placeAsync();
    view.findAnswer = () => Promise.resolve(FakeWebView.found(1, 2));

    const inToolbar: KeyboardEvent = press(button("Back"), withMod("f", "KeyF"));
    await vi.waitFor(() => expect(document.activeElement).toBe(findField()));
    await userEvent.keyboard("plan");
    await stableAsync();
    findField().setSelectionRange(4, 4);
    const inField: KeyboardEvent = press(findField(), withMod("f", "KeyF"));
    const selected: (number | null)[] = [findField().selectionStart, findField().selectionEnd];
    button("Back").focus();
    button("More").click();
    await stableAsync();
    menuItem("Find on page")?.click();
    await stableAsync();

    expect([inToolbar.defaultPrevented, inField.defaultPrevented, selected, document.activeElement === findField(), document.querySelectorAll("nol-browser-find-bar").length])
      .toEqual([true, true, [0, 4], true, 1]);
    expect(view.calls.filter(t => t.startsWith("find"))).toEqual(["find p", "find pl", "find pla", "find plan"]);
  });

  it("closes the find bar on Escape, ending its search, and gives the focus to Reload without stopping a loading page", async () => {
    const view: FakeWebView = await placeAsync();
    view.emit(new ViewStateEvent("https://two.example/", "Two", true, true, false));
    await stableAsync();
    view.findAnswer = () => Promise.resolve(FakeWebView.found(1, 2));
    press(button("Back"), withMod("f", "KeyF"));
    await vi.waitFor(() => expect(document.activeElement).toBe(findField()));
    await userEvent.keyboard("a");
    await stableAsync();

    const closing: KeyboardEvent = press(findField(), { key: "Escape", code: "Escape" });
    await stableAsync();

    expect([closing.defaultPrevented, document.querySelector("nol-browser-find-bar"), document.activeElement, view.calls.filter(t => t === "stop" || t === "endFind")])
      .toEqual([true, null, button("Reload", "Stop"), ["endFind"]]);
  });

  it("opens no find bar for the find key while the page has nothing loaded", async () => {
    await openAsync();

    const pressed: KeyboardEvent = press(button("Back"), withMod("f", "KeyF"));
    await stableAsync();

    expect([pressed.defaultPrevented, document.querySelector("nol-browser-find-bar")]).toEqual([true, null]);
  });

  it("leaves alone an input method's key, a held key's repeats, a press already handled, another key, and a key it doesn't take", async () => {
    const view: FakeWebView = await placeAsync();
    button("Back").addEventListener("keydown", t => t.preventDefault(), { once: true });

    const handled: KeyboardEvent = press(button("Back"), withMod("r", "KeyR"));
    const pressed: boolean[] = [
      press(field(), withMod("r", "KeyR", { isComposing: true })), press(button("Back"), withMod("r", "KeyR", { repeat: true })),
      press(button("Back"), withMod("x", "KeyX")), press(button("Back"), { key: "Escape", code: "Escape" })
    ].map(t => t.defaultPrevented);
    view.emitOther(WebViewEventKind.Key, { name: "print" });
    await stableAsync();

    expect([handled.defaultPrevented, pressed, view.calls.filter(t => t === "reload" || t === "stop"), context.opened.length]).toEqual([true, [false, false, false, false], [], 1]);
  });

});

@Component({
  imports: [PageComponent],
  template: `<button type="button" class="before">Before</button><div class="frame" style="width: 640px; height: 30rem"><nol-browser-page [instance]="instance()" /></div>`
})
class ColorsHostComponent {
  public readonly instance: WritableSignal<string> = signal("");
}

describe("PageComponent colors", () => {
  let context: WindowContext;
  let pages: Pages;
  let fixture: ComponentFixture<ColorsHostComponent> | null;
  let element: HTMLElement;

  function find(selector: string): HTMLElement {
    const found = element.querySelector<HTMLElement>(selector) ?? document.querySelector<HTMLElement>(selector);
    if (found === null)
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  }

  function button(...names: string[]): HTMLElement {
    const found: HTMLButtonElement | undefined = [...find("nol-browser-toolbar").querySelectorAll<HTMLButtonElement>("button")]
      .find(t => names.includes(t.getAttribute("aria-label") ?? ""));
    if (found === undefined)
      throw new Error(`The toolbar has no ${names.join(" or ")} button.`);
    return found;
  }

  function within(host: HTMLElement | undefined, selector: string): HTMLElement {
    const found: HTMLElement | null | undefined = host?.querySelector<HTMLElement>(selector);
    if (found === null || found === undefined)
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  }

  function stateAction(name: string): HTMLElement {
    const found: HTMLElement | undefined = [...element.querySelectorAll<HTMLElement>(".nol-browser-page-state-action")]
      .find(t => t.textContent?.trim() === name);
    if (found === undefined)
      throw new Error(`The page's state has no ${name} action.`);
    return found;
  }

  function menuItem(name: string): HTMLElement | undefined {
    return [...document.querySelectorAll<HTMLElement>(".nol-browser-toolbar-menu button")]
      .find(t => t.querySelector(".nol-menu-item-label")?.textContent?.trim() === name);
  }

  function field(): HTMLInputElement {
    const found = find("input.nol-browser-toolbar-field");
    if (!(found instanceof HTMLInputElement))
      throw new Error("The address field isn't an input.");
    return found;
  }

  async function openAsync(): Promise<FakeWebView> {
    fixture?.destroy();
    fixture = TestBed.createComponent(ColorsHostComponent);
    fixture.componentInstance.instance.set(pages.open("workspace-1", null));
    fixture.autoDetectChanges();
    const native: unknown = fixture.nativeElement;
    if (!(native instanceof HTMLElement))
      throw new Error("The fixture has no element.");
    element = native;
    await vi.waitFor(() => expect(element.querySelector("nol-browser-toolbar")).not.toBeNull());
    const view: FakeWebView | undefined = context.views.views.at(-1);
    if (view === undefined)
      throw new Error("The page opened no view.");
    return view;
  }

  async function emitAsync(view: FakeWebView, ...events: Parameters<FakeWebView["emit"]>[0][]): Promise<void> {
    for (const event of events)
      view.emit(event);
    await fixture?.whenStable();
  }

  async function loadingPageAsync(): Promise<FakeWebView> {
    const view = await openAsync();
    await emitAsync(view, new ViewStateEvent("http://one.example/docs", "One", true, true, false),
      new ViewRequestRefusalEvent(RefusedRequest.Download, "http://one.example"));
    find("button.before").focus();
    await fixture?.whenStable();
    return view;
  }

  async function actAsync(state: "Acting" | "Ended"): Promise<void> {
    context.emit(BrowserEvents.pageActivity, { instance: context.opened.at(-1)?.instance ?? "", activity: "call-1", agentName: "Scout", action: "Reading", state,
      box: null, point: null, refusal: null, isHandedOver: false });
    await fixture?.whenStable();
  }

  async function failedPageAsync(): Promise<FakeWebView> {
    const view = await openAsync();
    await emitAsync(view, new ViewLoadFailureEvent("https://gone.example/", -105, "ERR_NAME_NOT_RESOLVED"));
    return view;
  }

  async function tabToAsync(target: HTMLElement): Promise<void> {
    find("button.before").focus();
    for (let index = 0; index < 8 && document.activeElement !== target; index++)
      await userEvent.tab();
    expect(document.activeElement).toBe(target);
  }

  async function refuseAddressAsync(): Promise<void> {
    await userEvent.click(field());
    await userEvent.keyboard("release notes{Enter}");
    await vi.waitFor(() => expect(field().getAttribute("aria-invalid")).toBe("true"));
    find("button.before").focus();
  }

  function below(pairs: readonly (readonly [string, number, number])[]): string[] {
    return pairs.filter(([, ratio, minimum]) => ratio < minimum).map(([name, ratio, minimum]) => `${name}: ${ratio.toFixed(2)} < ${minimum}`);
  }

  beforeEach(() => {
    fixture = null;
    context = new WindowContext();
    pages = new Pages(context);
    AppearanceFixture.apply();
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
  });

  afterEach(async () => {
    try {
      (await AppearanceFixture.parkPointerAsync()).remove();
    }
    finally {
      // Vitest skips Angular's own reset after a hook that rejects, so the next test could not configure its module.
      fixture?.destroy();
      TestBed.resetTestingModule();
      pages.close();
      AppearanceFixture.reset();
      await EmulatedMediaFixture.resetAsync();
    }
  });

  for (const mode of [ThemeMode.Light, ThemeMode.Dark]) {
    it(`keeps text at 4.5:1 and control edges, state cues and focus at 3:1 against what lies under them, in ${mode}`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      await failedPageAsync();
      const pairs: (readonly [string, number, number])[] = [
        ["the state's glyph", ContrastFixture.ofText(find(".nol-browser-page-state-glyph")), 3],
        ["the state's heading", ContrastFixture.ofText(find(".nol-browser-page-state-heading")), 4.5],
        ["the state's detail", ContrastFixture.ofText(find(".nol-browser-page-state-detail")), 4.5],
        ["Try again", ContrastFixture.ofText(stateAction("Try again")), 4.5],
        ["Copy address", ContrastFixture.ofText(stateAction("Copy address")), 4.5]
      ];
      await loadingPageAsync();
      pairs.push(
        ["Back's glyph", ContrastFixture.ofText(within(button("Back"), ".nol-toolbar-button-glyph")), 3],
        ["Stop's glyph", ContrastFixture.ofText(within(button("Reload", "Stop"), ".nol-toolbar-button-glyph")), 3],
        ["More's glyph", ContrastFixture.ofText(within(button("More"), ".nol-toolbar-button-glyph")), 3],
        ["Not secure", ContrastFixture.ofText(find(".nol-browser-toolbar-security")), 4.5],
        ["the address's host", ContrastFixture.ofText(find(".nol-browser-toolbar-host")), 4.5],
        ["the address's path", ContrastFixture.ofText(find(".nol-browser-toolbar-path")), 4.5],
        ["the address field's border", ContrastFixture.ofEdge(find(".nol-browser-toolbar-address"), "border-top-color"), 3],
        ["the loading bar", ContrastFixture.ofFills(find("nol-progress .nol-progress-bar"), find(".nol-browser-toolbar-row")), 3],
        ["the notice's glyph", ContrastFixture.ofText(find(".nol-browser-request-notice-glyph")), 3],
        ["the notice", ContrastFixture.ofText(find(".nol-browser-request-notice-message")), 4.5],
        ["Open in external browser", ContrastFixture.ofText(find(".nol-browser-request-notice-action")), 4.5]
      );
      for (const [name, target, measure] of [
        ["Back's focus ring", () => button("Back"), () => ContrastFixture.ofOutline(button("Back"))],
        ["the address field's focus border", () => field(), () => ContrastFixture.ofEdge(find(".nol-browser-toolbar-address"), "border-top-color")],
        ["the address while edited", () => field(), () => ContrastFixture.ofText(field())],
        ["More's focus ring", () => button("More"), () => ContrastFixture.ofOutline(button("More"))],
        ["the notice action's focus ring", () => find(".nol-browser-request-notice-action"), () => ContrastFixture.ofOutline(find(".nol-browser-request-notice-action"))]
      ] as const) {
        await tabToAsync(target());
        pairs.push([name, measure(), name === "the address while edited" ? 4.5 : 3]);
      }
      await actAsync("Acting");
      pairs.push(
        ["the bar's glyph", ContrastFixture.ofText(find(".nol-browser-agent-bar-glyph")), 3],
        ["the bar's message", ContrastFixture.ofText(find(".nol-browser-agent-bar-message")), 4.5],
        ["the bar's name", ContrastFixture.ofText(find(".nol-browser-agent-bar-name")), 4.5]
      );
      for (const [name, action] of [["Take over", 1], ["Stop teammate", 2]] as const) {
        const target = (): HTMLElement => find(`.nol-browser-agent-bar-action:nth-of-type(${action})`);
        pairs.push([name, ContrastFixture.ofText(target()), 4.5]);
        await tabToAsync(target());
        pairs.push([`${name}'s focus ring`, ContrastFixture.ofOutline(target()), 3]);
      }
      await actAsync("Ended");
      button("More").click();
      await fixture?.whenStable();
      await vi.waitFor(() => expect(document.querySelectorAll(".nol-browser-toolbar-menu button[nol-menu-item]")).toHaveLength(5));
      pairs.push(["Copy address in the menu", ContrastFixture.ofText(find(".nol-browser-toolbar-menu button[nol-menu-item] .nol-menu-item-label")), 4.5]);
      pairs.push(["Zoom's percent in the menu", ContrastFixture.ofText(within(menuItem("Zoom"), ".nol-menu-item-value")), 4.5]);
      await userEvent.keyboard("{Escape}");
      await refuseAddressAsync();
      pairs.push(["the invalid address field's border", ContrastFixture.ofEdge(find(".nol-browser-toolbar-address"), "border-top-color"), 3]);

      expect(below(pairs)).toEqual([]);
    });
  }

  it("keeps a cue in system colors for focus, the invalid field, loading, the notice and the menu's border under forced colors", async () => {
    await ForcedColorsFixture.activateAsync();
    const highlight = ForcedColorsFixture.resolve("Highlight");
    const text = ForcedColorsFixture.resolve("CanvasText");
    await loadingPageAsync();
    const bar = getComputedStyle(find(".nol-browser-request-notice-bar"));
    const cues: unknown[] = [
      ["loading bar", getComputedStyle(find("nol-progress .nol-progress-bar")).backgroundColor],
      ["notice", bar.borderTopStyle, bar.borderTopColor],
      ["address field", getComputedStyle(find(".nol-browser-toolbar-address")).borderTopStyle, getComputedStyle(find(".nol-browser-toolbar-address")).borderTopColor]
    ];
    for (const [name, target, ring] of [
      ["toolbar button", () => button("Back"), () => button("Back")],
      ["address field", () => field(), () => find(".nol-browser-toolbar-address")],
      ["notice action", () => find(".nol-browser-request-notice-action"), () => find(".nol-browser-request-notice-action")]
    ] as const) {
      await tabToAsync(target());
      const style = getComputedStyle(ring());
      cues.push([`${name} focus`, style.outlineStyle, style.outlineColor, Number.parseFloat(style.outlineWidth) >= 2]);
    }
    button("More").click();
    await fixture?.whenStable();
    const menu = await vi.waitFor(() => find(".nol-browser-toolbar-menu"));
    cues.push(["menu", getComputedStyle(menu).borderTopStyle, getComputedStyle(menu).borderTopColor, getComputedStyle(menu).boxShadow]);
    cues.push(["unavailable Forward", getComputedStyle(button("Forward")).color]);
    await userEvent.keyboard("{Escape}");
    await refuseAddressAsync();
    const invalid = getComputedStyle(find(".nol-browser-toolbar-address"));
    cues.push(["invalid field", invalid.borderTopStyle, invalid.borderTopColor, invalid.borderTopWidth]);

    expect(cues).toEqual([
      ["loading bar", highlight],
      ["notice", "solid", text],
      ["address field", "solid", text],
      ["toolbar button focus", "solid", highlight, true],
      ["address field focus", "solid", highlight, true],
      ["notice action focus", "solid", highlight, true],
      ["menu", "solid", text, "none"],
      ["unavailable Forward", ForcedColorsFixture.resolve("GrayText")],
      ["invalid field", "dashed", text, "2px"]
    ]);
  });

  it("keeps the page's top where it is when a load starts and when it ends, with the bar filling its kept space, in Light, in Dark and under forced colors", async () => {
    const moves: unknown[] = [];
    for (const mode of [ThemeMode.Light, ThemeMode.Dark, null]) {
      if (mode === null)
        await ForcedColorsFixture.activateAsync();
      else
        AppearanceFixture.apply(DefaultTheme.theme, mode);
      const view = await openAsync();
      const top = (): number => find(".nol-browser-page-view").getBoundingClientRect().top;
      await emitAsync(view, new ViewStateEvent("https://one.example/", "One", false, false, false));
      const idle = top();
      await emitAsync(view, new ViewStateEvent("https://one.example/", "One", true, false, false));
      const loading = top();
      const bar = find("nol-progress").getBoundingClientRect().height;
      const box = find(".nol-browser-toolbar-progress").getBoundingClientRect().height;
      await emitAsync(view, new ViewStateEvent("https://one.example/", "One", false, false, false));
      moves.push([mode ?? "forced colors", bar > 0, box - bar, loading - idle, top() - idle]);
    }

    expect(moves).toEqual([[ThemeMode.Light, true, 0, 0, 0], [ThemeMode.Dark, true, 0, 0, 0], ["forced colors", true, 0, 0, 0]]);
  });

  it("stops the loading bar's movement, the page's only animation, when reduced motion is preferred", async () => {
    await loadingPageAsync();
    const moving = element.getAnimations({ subtree: true }).length;
    await MotionFixture.reduceAsync();
    await fixture?.whenStable();

    expect([moving > 0, element.getAnimations({ subtree: true }), getComputedStyle(find("nol-progress .nol-progress-bar")).animationName]).toEqual([true, [], "none"]);
  });
});

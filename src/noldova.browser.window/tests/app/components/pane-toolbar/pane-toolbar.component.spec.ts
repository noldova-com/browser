/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, type Signal, type WritableSignal, signal, viewChild } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { TypedAddressRefusal } from "@noldova/browser.protocol";
import type { WebViewNavigation } from "@noldova/desktop.protocol";
import { AnnouncementPoliteness, Announcer, ClipboardWriter, DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, ClipboardWriterFixture, PointerFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { PaneToolbarComponent } from "../../../../src/app/components/pane-toolbar/pane-toolbar.component.ts";
import type { ViewEvent } from "../../../../src/app/models/view-event.ts";
import { ViewLoadFailureEvent } from "../../../../src/app/models/view-load-failure-event.ts";
import { ViewRefusalEvent } from "../../../../src/app/models/view-refusal-event.ts";
import { ViewStateEvent } from "../../../../src/app/models/view-state-event.ts";
import { ViewZoomEvent } from "../../../../src/app/models/view-zoom-event.ts";
import { PaneController } from "../../../../src/app/services/pane-controller.ts";
import { FakeWebView, FakeWebViews, WebViewValues } from "../../../fixtures/fake-web-views.fixture.ts";
import { ForcedColorsFixture } from "../../../fixtures/forced-colors.fixture.ts";
import { ZoomFixture } from "../../../fixtures/zoom.fixture.ts";

@Component({
  imports: [PaneToolbarComponent],
  template: `<div class="frame" style="margin-top: 20rem" [style.width.px]="width()"><nol-browser-toolbar [controller]="controller()" [openLink]="openLink()" noticeId="notice-1" [shownAddress]="shownAddress()" (addressEntered)="entered.push($event)"
    (clearBrowsingData)="cleared = cleared + 1" (findRequested)="findings = findings + 1" /></div>
    <div class="probe" style="background: var(--nol-input); border: 1px solid var(--nol-input-border); color: var(--nol-text-strong); outline: 1px solid var(--nol-accent)"></div>
    <div class="muted" style="color: var(--nol-text-muted); border-radius: var(--nol-radius-small); height: var(--nol-field-height)"></div>`
})
class HostComponent {
  public readonly width: WritableSignal<number> = signal(640);
  public readonly controller: WritableSignal<PaneController> = signal(new PaneController(null));
  public readonly openLink: WritableSignal<((url: string) => Promise<void>) | null> = signal(null);
  public readonly shownAddress: WritableSignal<string | null> = signal(null);
  public readonly entered: string[] = [];
  public cleared: number = 0;
  public findings: number = 0;
  public readonly toolbar: Signal<PaneToolbarComponent> = viewChild.required(PaneToolbarComponent);
}

const LOADING_BAR_HEIGHT: number = 2;

describe("PaneToolbarComponent", () => {
  const LONG = `https://example.test/${"long-path/".repeat(40)}`;
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;
  let view: FakeWebView;
  let controller: PaneController;
  let errors: unknown[];
  let checkedErrors: number;
  let said: [string, AnnouncementPoliteness][];
  let groups: (string | undefined)[];
  let clipboard: ClipboardWriterFixture;

  function state(address: string, isLoading: boolean = false, canGoBack: boolean = false, canGoForward: boolean = false): ViewEvent {
    return new ViewStateEvent(address, "Page", isLoading, canGoBack, canGoForward);
  }

  function button(...names: string[]): HTMLButtonElement {
    const found: HTMLButtonElement | undefined = [...element.querySelectorAll<HTMLButtonElement>("button")]
      .find(t => names.includes(t.getAttribute("aria-label") ?? ""));
    if (found === undefined)
      throw new Error(`The toolbar has no ${names.join(" or ")} button.`);
    return found;
  }

  function field(): HTMLInputElement {
    const found: HTMLInputElement | null = element.querySelector<HTMLInputElement>("input.nol-browser-toolbar-field");
    if (found === null)
      throw new Error("The toolbar has no address field.");
    return found;
  }

  function expectErrors(expected: readonly unknown[]): void {
    expect(errors).toEqual(expected);
    checkedErrors = errors.length;
  }

  function tooltipNamed(name: string): HTMLElement {
    const shown: HTMLElement | undefined = [...document.querySelectorAll<HTMLElement>(".cdk-overlay-container nol-tooltip")].find(t => t.textContent?.trim() === name);
    if (shown === undefined)
      throw new Error(`No tooltip shows ${name}.`);
    return shown;
  }

  async function showAsync(event: ViewEvent): Promise<void> {
    view.emit(event);
    await fixture.whenStable();
  }

  async function loadAsync(address: string): Promise<void> {
    view.emit(state(address, true));
    await showAsync(state(address));
  }

  function find(selector: string): HTMLElement {
    const found: HTMLElement | null = document.querySelector<HTMLElement>(selector);
    if (found === null)
      throw new Error(`The page has no ${selector}.`);
    return found;
  }

  function rem(pixels: number): number {
    return Math.round(pixels / AppearanceFixture.toPixels(1) * 10000) / 10000;
  }

  function labels(opened: readonly HTMLButtonElement[]): [string | undefined, string | undefined, string | null][] {
    return opened.map(t => [t.querySelector(".nol-menu-item-icon")?.textContent?.trim(), t.querySelector(".nol-menu-item-label")?.textContent?.trim(), t.getAttribute("aria-disabled")]);
  }

  function items(): HTMLButtonElement[] {
    return [...document.querySelectorAll<HTMLButtonElement>(".nol-browser-toolbar-menu button[nol-menu-item]")];
  }

  async function openMenuAsync(): Promise<HTMLButtonElement[]> {
    button("More").click();
    await fixture.whenStable();
    return items();
  }

  function zoomItems(): HTMLButtonElement[] {
    return [...document.querySelectorAll<HTMLButtonElement>(".nol-browser-toolbar-zoom-menu button[nol-menu-item]")];
  }

  function trail(row: Element | undefined): string | undefined {
    return row?.querySelector(".nol-menu-item-shortcut")?.textContent?.trim();
  }

  function percent(row: Element | undefined): string | undefined {
    return row?.querySelector(".nol-menu-item-value")?.textContent?.trim();
  }

  async function openZoomAsync(): Promise<HTMLButtonElement[]> {
    (await openMenuAsync())[3]?.click();
    await fixture.whenStable();
    await vi.waitFor(() => expect(zoomItems().length).toBe(3));
    return zoomItems();
  }

  async function closeMenusAsync(): Promise<void> {
    for (let press = 0; press < 2 && items().length > 0; press++) {
      await userEvent.keyboard("{Escape}");
      await fixture.whenStable();
    }
    expect([items(), zoomItems()]).toEqual([[], []]);
  }

  async function shownZoomAsync(): Promise<string | undefined> {
    const shown: string | undefined = percent((await openMenuAsync())[3]);
    await closeMenusAsync();
    return shown;
  }

  async function measuredAsync(): Promise<void> {
    await new Promise<void>(resolve => {
      const observer: ResizeObserver = new ResizeObserver(() => {
        observer.disconnect();
        resolve();
      });
      observer.observe(find("nol-browser-toolbar"));
    });
    await fixture.whenStable();
  }

  function overlaps(first: DOMRect, second: DOMRect): boolean {
    return first.left < second.right - 0.5 && second.left < first.right - 0.5 && first.top < second.bottom - 0.5 && second.top < first.bottom - 0.5;
  }

  function hasTargetSize(target: DOMRect, others: readonly DOMRect[]): boolean {
    const size = 24;
    const isSmall = (box: DOMRect): boolean => box.width < size - 0.5 || box.height < size - 0.5;
    const centre = (box: DOMRect): [number, number] => [(box.left + box.right) / 2, (box.top + box.bottom) / 2];
    const [x, y] = centre(target);
    return !isSmall(target) || others.every(t => Math.hypot(Math.max(t.left - x, 0, x - t.right), Math.max(t.top - y, 0, y - t.bottom)) >= size / 2 &&
      (!isSmall(t) || Math.hypot(centre(t)[0] - x, centre(t)[1] - y) >= size));
  }

  beforeEach(async () => {
    errors = [];
    checkedErrors = 0;
    said = [];
    groups = [];
    clipboard = new ClipboardWriterFixture();
    AppearanceFixture.apply();
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } },
        { provide: ClipboardWriter, useValue: clipboard }
      ]
    });
    const announcer: Announcer = TestBed.inject(Announcer);
    const announce = announcer.announce.bind(announcer);
    vi.spyOn(announcer, "announce").mockImplementation((message, politeness, options) => {
      said.push([message, politeness]);
      groups.push(options?.group);
      announce(message, politeness, options);
    });
    view = new FakeWebViews().open("workspace-1");
    controller = new PaneController(view);
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.controller.set(controller);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const native: unknown = fixture.nativeElement;
    if (!(native instanceof HTMLElement))
      throw new Error("The fixture has no element.");
    element = native;
  });

  afterEach(async () => {
    try {
      vi.restoreAllMocks();
      (await AppearanceFixture.parkPointerAsync()).remove();
      fixture.destroy();
    }
    finally {
      AppearanceFixture.reset();
      await Promise.all([ForcedColorsFixture.resetAsync(), ZoomFixture.resetAsync()]);
    }
    expect(errors.slice(checkedErrors)).toEqual([]);
  });

  it("names its buttons and leaves the ones with nothing to do focusable but unavailable", () => {
    expect([button("Back"), button("Forward"), button("Reload", "Stop")].map(t => [t.getAttribute("aria-label"), t.getAttribute("aria-disabled"), t.disabled]))
      .toEqual([["Back", "true", false], ["Forward", "true", false], ["Reload", "true", false]]);
    expect(element.querySelector("[role=toolbar]")?.getAttribute("aria-label")).toBe("Page");
    expect([field().value, field().getAttribute("aria-label"), element.querySelector("nol-progress")]).toEqual(["", "Address", null]);
  });

  it("does nothing for an unavailable button", async () => {
    button("Back").click();
    button("Forward").click();
    button("Reload", "Stop").click();
    await fixture.whenStable();

    expect([view.calls, errors]).toEqual([[], []]);
  });

  it("goes back and forward while the page has history there", async () => {
    await showAsync(state("https://one.example/", false, true, true));

    button("Back").click();
    button("Forward").click();
    await fixture.whenStable();

    expect([button("Back").getAttribute("aria-disabled"), button("Forward").getAttribute("aria-disabled")]).toEqual([null, null]);
    expect(view.calls).toEqual(["back", "forward"]);
  });

  it("turns Reload into Stop in the same place while the page loads, with the progress bar under the row", async () => {
    const reload = button("Reload", "Stop");
    await showAsync(state("https://one.example/", true));

    expect([button("Reload", "Stop"), reload.getAttribute("aria-label"), reload.textContent?.trim(), reload.getAttribute("aria-disabled")]).toEqual([reload, "Stop", "close", null]);
    const bar: HTMLElement = find("nol-progress");
    const row: HTMLElement = find(".nol-browser-toolbar-row");

    expect([bar.getAttribute("aria-label"), bar.getBoundingClientRect().top >= row.getBoundingClientRect().bottom - 0.5]).toEqual(["Loading the page", true]);
    reload.click();
    await showAsync(state("https://one.example/"));

    expect([reload.getAttribute("aria-label"), reload.textContent?.trim(), element.querySelector("nol-progress")]).toEqual(["Reload", "refresh", null]);
    reload.click();
    await fixture.whenStable();

    expect(view.calls).toEqual(["stop", "reload"]);
  });

  it("says politely once that the page is loading and once that it has loaded, by its title or else its address, without taking focus", async () => {
    const before = document.activeElement;
    view.emit(state("https://one.example/", true));
    await showAsync(state("https://one.example/", true));
    await showAsync(state("https://one.example/"));
    await showAsync(state("https://one.example/"));
    view.emit(new ViewStateEvent("https://two.example/", "", true, true, false));
    await showAsync(new ViewStateEvent("https://two.example/", "", false, true, false));

    expect([said, document.activeElement]).toEqual([[
      ["Loading the page.", AnnouncementPoliteness.Polite], ["Page loaded.", AnnouncementPoliteness.Polite],
      ["Loading the page.", AnnouncementPoliteness.Polite], ["https://two.example/ loaded.", AnnouncementPoliteness.Polite]
    ], before]);
    expect([new Set(groups).size, groups[0]?.endsWith("-load")]).toEqual([1, true]);
  });

  it("says the load stopped when the person stops it, and that the next load's page loaded", async () => {
    await showAsync(state("https://one.example/", true));

    button("Reload", "Stop").click();
    await showAsync(state("https://one.example/"));
    await showAsync(state("https://two.example/", true));
    await showAsync(state("https://two.example/"));

    expect([view.calls, said.map(t => t[0])]).toEqual([["stop"], ["Loading the page.", "Stopped loading the page.", "Loading the page.", "Page loaded."]]);
  });

  it("says the page loaded when a Stop the person pressed failed, and hands the failure to the error handler", async () => {
    const failure = new Error("The bridge is gone.");
    await showAsync(state("https://one.example/", true));
    view.failNextCall(failure);

    button("Reload", "Stop").click();
    await vi.waitFor(() => expectErrors([failure]));
    await showAsync(state("https://one.example/"));

    expect(said.map(t => t[0])).toEqual(["Loading the page.", "Page loaded."]);
  });

  it("keeps a later Stop standing when an earlier one fails after it", async () => {
    const failure = new Error("The bridge is gone.");
    const first = Promise.withResolvers<WebViewNavigation>();
    const second = Promise.withResolvers<WebViewNavigation>();
    vi.spyOn(controller, "stopAsync").mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await showAsync(state("https://one.example/", true));

    button("Reload", "Stop").click();
    button("Reload", "Stop").click();
    first.reject(failure);
    await vi.waitFor(() => expectErrors([failure]));
    await showAsync(state("https://one.example/"));
    second.resolve(WebViewValues.started);

    expect(said.map(t => t[0])).toEqual(["Loading the page.", "Stopped loading the page."]);
  });

  it("forgets a Stop pressed in another tab once the controller changes", async () => {
    await showAsync(state("https://one.example/", true));
    button("Reload", "Stop").click();
    const next = new FakeWebViews().open("workspace-2");
    const following = new PaneController(next);
    next.emit(state("https://two.example/", true));
    fixture.componentInstance.controller.set(following);
    await fixture.whenStable();
    said.length = 0;

    next.emit(state("https://two.example/"));
    await fixture.whenStable();

    expect(said.map(t => t[0])).toEqual(["Page loaded."]);
  });

  it("says nothing of a load that fails, or of another tab's page that is already loading", async () => {
    view.emit(state("https://one.example/", true));
    await showAsync(new ViewLoadFailureEvent("https://one.example/", -105, "The server's address wasn't found."));
    said.length = 0;
    const next = new FakeWebViews().open("workspace-2");
    const following = new PaneController(next);
    next.emit(state("https://two.example/", true));
    fixture.componentInstance.controller.set(following);
    await fixture.whenStable();

    expect([said, button("Reload", "Stop").getAttribute("aria-label")]).toEqual([[], "Stop"]);
  });

  it("reloads a page that failed, was refused or crashed", async () => {
    await showAsync(new ViewLoadFailureEvent("https://one.example/", -105, "No answer"));
    button("Reload", "Stop").click();
    await fixture.whenStable();

    expect([button("Reload", "Stop").getAttribute("aria-disabled"), view.calls]).toEqual([null, ["reload"]]);
  });

  it("hands a failed call to the error handler", async () => {
    const failure = new Error("The bridge is gone.");
    await showAsync(state("https://one.example/", false, true));
    view.failNextCall(failure);

    button("Back").click();
    await vi.waitFor(() => expectErrors([failure]));
  });

  it("draws an https page's host and path over the field, after a lock, without the scheme, and the whole address once the person edits it", async () => {
    await showAsync(state("https://docs.example.com/pricing?plan=team"));
    const glyph = (): string | undefined => element.querySelector(".nol-browser-toolbar-address > .nol-browser-toolbar-glyph")?.textContent?.trim();
    const drawn = (): (string | undefined)[] => [element.querySelector(".nol-browser-toolbar-host")?.textContent, element.querySelector(".nol-browser-toolbar-path")?.textContent];

    expect([glyph(), drawn(), field().value, getComputedStyle(field()).color]).toEqual(["lock", ["docs.example.com", "/pricing?plan=team"], "https://docs.example.com/pricing?plan=team", "rgba(0, 0, 0, 0)"]);
    await userEvent.click(field());
    await fixture.whenStable();

    expect([drawn(), field().selectionStart, field().selectionEnd, getComputedStyle(field()).color]).toEqual([[undefined, undefined], 0, field().value.length, getComputedStyle(find(".probe")).color]);
    await userEvent.click(field());

    expect(field().selectionStart).toBe(field().selectionEnd);
    field().blur();
    await showAsync(state("about:blank"));

    expect([glyph(), drawn(), field().value, element.querySelector(".nol-browser-toolbar-security")]).toEqual([undefined, [undefined, undefined], "about:blank", null]);
  });

  it("shows the address, and marks an http page as not secure", async () => {
    await showAsync(state("http://plain.example/page"));
    const mark: HTMLElement = find(".nol-browser-toolbar-security");

    expect([field().value, field().getAttribute("aria-label"), mark.lastChild?.textContent?.trim()]).toEqual(["http://plain.example/page", "http://plain.example/page", "Not secure"]);
    expect(field().getAttribute("aria-describedby")).toBe(mark.id);
    const markBox = mark.getBoundingClientRect();
    const fieldBox = field().getBoundingClientRect();
    const middle = (markBox.top + markBox.bottom) / 2;

    expect([markBox.right <= fieldBox.left, middle > fieldBox.top && middle < fieldBox.bottom]).toEqual([true, true]);
    await showAsync(state("https://secure.example/page"));

    expect([field().value, element.querySelector(".nol-browser-toolbar-security"), field().hasAttribute("aria-describedby")]).toEqual(["https://secure.example/page", null, false]);
  });

  it("cuts a long address with an ellipsis and shows all of it in a tooltip below the field", async () => {
    await showAsync(state(LONG));
    await measuredAsync();

    const path = find(".nol-browser-toolbar-path");
    const style = getComputedStyle(path);

    expect([path.hasAttribute("data-truncates"), style.textOverflow, style.whiteSpace, path.scrollWidth > path.clientWidth, getComputedStyle(field()).textOverflow])
      .toEqual([true, "ellipsis", "nowrap", true, "ellipsis"]);
    expect(field().getAttribute("aria-label")).toBe(LONG);
    await PointerFixture.hoverAsync(field());
    const tooltip: HTMLElement = await vi.waitFor(() => tooltipNamed(LONG));

    expect(tooltip.getBoundingClientRect().top).toBeGreaterThanOrEqual(find(".nol-browser-toolbar-address").getBoundingClientRect().bottom - 0.5);
  });

  it("is one tab stop that the arrow keys move along", async () => {
    await showAsync(state("https://one.example/", false, true, true));
    const buttons = [button("Back"), button("Forward"), button("Reload", "Stop")];

    expect(buttons.map(t => t.tabIndex)).toEqual([0, -1, -1]);
    button("Back").focus();
    await userEvent.keyboard("{ArrowRight}");
    await fixture.whenStable();

    expect([document.activeElement, buttons.map(t => t.tabIndex)]).toEqual([button("Forward"), [-1, 0, -1]]);
  });

  it("ends the row with More, its own tab stop after the address field, with a tooltip below it", async () => {
    await showAsync(state("https://one.example/"));
    field().focus();
    await userEvent.tab();
    await fixture.whenStable();

    expect([document.activeElement, button("More").getAttribute("aria-label"), button("More").tabIndex, button("More").getAttribute("aria-haspopup")]).toEqual([button("More"), "More", 0, "menu"]);
    await PointerFixture.hoverAsync(button("More"));
    const tip: HTMLElement = await vi.waitFor(() => tooltipNamed("More"));

    expect([tip.textContent?.trim(), tip.getBoundingClientRect().top >= button("More").getBoundingClientRect().bottom - 0.5, button("More").textContent?.trim()]).toEqual(["More", true, "more_horiz"]);
  });

  it("opens Copy address, Open in external browser, Find on page, Zoom and Clear browsing data under More, each with its glyph", async () => {
    fixture.componentInstance.openLink.set(() => Promise.resolve());
    await loadAsync("https://one.example/");

    const opened = await openMenuAsync();

    expect(labels(opened)).toEqual([
      ["content_copy", "Copy address", null],
      ["open_in_new", "Open in external browser", null],
      ["search", "Find on page", null],
      ["zoom_in", "Zoom", null],
      ["delete_sweep", "Clear browsing data…", null]
    ]);
    const panel = find(".nol-browser-toolbar-menu").getBoundingClientRect();
    expect(panel.top).toBeGreaterThanOrEqual(button("More").getBoundingClientRect().bottom - 0.5);
    AppearanceFixture.expectPixels(panel.right, button("More").getBoundingClientRect().right);
    await userEvent.keyboard("{Escape}");
    await fixture.whenStable();

    expect([items(), document.activeElement]).toEqual([[], button("More")]);
  });

  it("opens the menu from the keyboard, with Enter or Down, with the focus on its first item", async () => {
    await loadAsync("https://one.example/");

    for (const key of ["{Enter}", "{ArrowDown}"]) {
      button("More").focus();
      await userEvent.keyboard(key);
      await fixture.whenStable();

      await vi.waitFor(() => expect([key, items().length, document.activeElement]).toEqual([key, 5, items()[0]]));
      await userEvent.keyboard("{Escape}");
      await fixture.whenStable();
      expect([key, items(), document.activeElement]).toEqual([key, [], button("More")]);
    }
  });

  it("keeps unavailable items focusable by the arrow keys, marked unavailable, and does nothing for them", async () => {
    button("More").focus();
    await userEvent.keyboard("{Enter}");
    await fixture.whenStable();
    await vi.waitFor(() => expect(document.activeElement).toBe(items()[0]));

    await userEvent.keyboard("{ArrowDown}");

    expect([document.activeElement === items()[1], items().map(t => t.getAttribute("aria-disabled"))]).toEqual([true, ["true", "true", "true", null, null]]);
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{ArrowUp}{Enter}");
    await fixture.whenStable();

    expect([said, errors]).toEqual([[], []]);
    await userEvent.keyboard("{Escape}");
    await fixture.whenStable();

    expect([items(), document.activeElement]).toEqual([[], button("More")]);
  });

  it("copies the shown page's address through the window's clipboard, says so politely and gives the focus back to More", async () => {
    await loadAsync("https://one.example/page");
    button("More").focus();
    await userEvent.keyboard("{ArrowDown}");
    await vi.waitFor(() => expect(document.activeElement).toBe(items()[0]));

    await userEvent.keyboard("{Enter}");
    await fixture.whenStable();

    await vi.waitFor(() => expect(said.at(-1)).toEqual(["Address copied.", AnnouncementPoliteness.Polite]));
    expect([clipboard.texts, items(), document.activeElement, errors]).toEqual([["https://one.example/page"], [], button("More"), []]);
  });

  it("says the address wasn't copied when the window's clipboard refuses it", async () => {
    clipboard.answer = () => Promise.resolve(false);
    await loadAsync("https://one.example/page");

    (await openMenuAsync())[0]?.click();
    await fixture.whenStable();

    await vi.waitFor(() => expect(said.at(-1)).toEqual(["The address wasn't copied.", AnnouncementPoliteness.Polite]));
    expect([clipboard.texts, errors]).toEqual([["https://one.example/page"], []]);
  });

  it("opens the shown page in the external browser through the window part's link call", async () => {
    const opened: string[] = [];
    fixture.componentInstance.openLink.set(url => {
      opened.push(url);
      return Promise.resolve();
    });
    await loadAsync("http://plain.example/");

    (await openMenuAsync())[1]?.click();
    await fixture.whenStable();

    await vi.waitFor(() => expect(opened).toEqual(["http://plain.example/"]));
    expect([view.calls, errors]).toEqual([[], []]);
  });

  it("asks the page to clear its workspace's browsing data, and gives the focus back to More", async () => {
    await loadAsync("https://one.example/");
    button("More").focus();
    await userEvent.keyboard("{ArrowUp}");
    await vi.waitFor(() => expect(document.activeElement).toBe(items()[4]));

    await userEvent.keyboard("{Enter}");
    await fixture.whenStable();

    expect([fixture.componentInstance.cleared, items(), document.activeElement, errors]).toEqual([1, [], button("More"), []]);
  });

  it("asks the page to find on it from Find on page, which shows Noldova Desktop's find key, and does nothing for it without a page", async () => {
    (await openMenuAsync())[2]?.click();
    await closeMenusAsync();
    const shown: number = fixture.componentInstance.findings;
    await loadAsync("https://one.example/");
    const find = (await openMenuAsync())[2];

    expect(trail(find)).toBe(navigator.platform.startsWith("Mac") ? "⌘F" : "Ctrl+F");
    find?.click();
    await fixture.whenStable();

    expect([shown, fixture.componentInstance.findings, items(), document.activeElement]).toEqual([0, 1, [], button("More")]);
  });

  it("makes Copy address and Find on page unavailable without a page, Open in external browser for an address that isn't a web page's or without a link call, and Zoom and Clear browsing data without a view", async () => {
    const states: (string | null)[][] = [];
    const readAsync = async (): Promise<void> => {
      states.push((await openMenuAsync()).map(t => t.getAttribute("aria-disabled")));
      await userEvent.keyboard("{Escape}");
      await fixture.whenStable();
    };
    await readAsync();
    await loadAsync("https://one.example/");
    await readAsync();
    fixture.componentInstance.openLink.set(() => Promise.resolve());
    await loadAsync("about:blank");
    await readAsync();
    await loadAsync("https://one.example/");
    await readAsync();
    fixture.componentInstance.controller.set(new PaneController(null));
    await fixture.whenStable();
    await readAsync();

    expect(states).toEqual([["true", "true", "true", null, null], [null, "true", null, null, null], [null, "true", null, null, null], [null, null, null, null, null],
      ["true", "true", "true", "true", "true"]]);
  });

  it("shows the page's zoom at More's Zoom, which opens Zoom in, Zoom out and Reset to 100%, each with its glyph and Noldova Desktop's key", async () => {
    await loadAsync("https://one.example/");
    const zoom = (await openMenuAsync())[3];

    expect([percent(zoom), trail(zoom), zoom?.querySelector(".nol-menu-item-chevron") !== null, zoom?.getAttribute("aria-haspopup")]).toEqual(["100%", undefined, false, "menu"]);
    zoom?.click();
    await fixture.whenStable();
    await vi.waitFor(() => expect(zoomItems().length).toBe(3));
    const [zoomIn, zoomOut, reset] = navigator.platform.startsWith("Mac") ? ["⌘=", "⌘-", "⌘0"] : ["Ctrl+=", "Ctrl+-", "Ctrl+0"];

    expect(zoomItems().map(t => [...labels([t])[0] ?? [], trail(t)])).toEqual([
      ["add", "Zoom in", null, zoomIn],
      ["remove", "Zoom out", null, zoomOut],
      ["fit_screen", "Reset to 100%", "true", reset]
    ]);
  });

  it("steps the page's zoom from Zoom's rows, shows the new zoom at Zoom and says it politely, a later step's message replacing an earlier one's", async () => {
    await loadAsync("https://one.example/");
    const shown: (string | undefined)[] = [];

    for (const name of ["Zoom in", "Zoom in", "Zoom out", "Reset to 100%"]) {
      (await openZoomAsync()).find(t => t.querySelector(".nol-menu-item-label")?.textContent?.trim() === name)?.click();
      await fixture.whenStable();
      await vi.waitFor(() => expect(items()).toEqual([]));
      shown.push(await shownZoomAsync());
    }

    await vi.waitFor(() => expect(said.length).toBe(6));
    expect([shown, view.calls.filter(t => t.toLowerCase().includes("zoom")), said.slice(2), new Set(groups.slice(2)).size, groups[2] === groups[0], errors]).toEqual([
      ["110%", "125%", "110%", "100%"],
      ["zoomIn", "zoomIn", "zoomOut", "setZoom 1"],
      [["Zoom 110%.", AnnouncementPoliteness.Polite], ["Zoom 125%.", AnnouncementPoliteness.Polite], ["Zoom 110%.", AnnouncementPoliteness.Polite], ["Zoom 100%.", AnnouncementPoliteness.Polite]],
      1, false, []
    ]);
  });

  it("opens Zoom's rows from the keyboard with the right arrow, and gives the focus back to More once one is chosen", async () => {
    await loadAsync("https://one.example/");
    button("More").focus();
    await userEvent.keyboard("{ArrowDown}");
    await vi.waitFor(() => expect(document.activeElement).toBe(items()[0]));

    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowRight}");
    await vi.waitFor(() => expect(document.activeElement).toBe(zoomItems()[0]));
    await userEvent.keyboard("{Enter}");
    await fixture.whenStable();

    await vi.waitFor(() => expect([items(), zoomItems(), document.activeElement]).toEqual([[], [], button("More")]));
    expect([view.calls.filter(t => t.toLowerCase().includes("zoom")), await shownZoomAsync()]).toEqual([["zoomIn"], "110%"]);
  });

  it("follows the zoom the person sets by keys or the wheel, while the menu is open too, and each tab's own zoom as the controller changes", async () => {
    await loadAsync("https://one.example/");
    await showAsync(new ViewZoomEvent(1.5));
    const first = await shownZoomAsync();
    const zoom = (await openMenuAsync())[3];
    await showAsync(new ViewZoomEvent(0.67));
    const open = percent(zoom);
    await closeMenusAsync();
    const next = new FakeWebViews().open("workspace-2");
    fixture.componentInstance.controller.set(new PaneController(next));
    await fixture.whenStable();
    const second = await shownZoomAsync();
    await showAsync(new ViewZoomEvent(2));
    const third = await shownZoomAsync();
    fixture.componentInstance.controller.set(controller);
    await fixture.whenStable();

    expect([first, open, second, third, await shownZoomAsync(), said.map(t => t[0])]).toEqual(["150%", "67%", "100%", "100%", "200%", ["Loading the page.", "Page loaded."]]);
  });

  it("makes Zoom in unavailable at 500%, Zoom out at 25% and Reset to 100% at 100%", async () => {
    await loadAsync("https://one.example/");
    const states: (string | null)[][] = [];

    for (const factor of [5, 0.25, 1.1]) {
      await showAsync(new ViewZoomEvent(factor));
      states.push((await openZoomAsync()).map(t => t.getAttribute("aria-disabled")));
      await closeMenusAsync();
    }

    expect(states).toEqual([["true", null, null], [null, "true", null], [null, null, null]]);
  });

  it("hands a zoom that failed to the error handler, and says no zoom", async () => {
    const failure = new Error("The host refused.");
    await loadAsync("https://one.example/");
    const rows = await openZoomAsync();
    view.failNextCall(failure);

    rows[0]?.click();
    await fixture.whenStable();

    await vi.waitFor(() => expectErrors([failure]));
    expect([said.map(t => t[0]), await shownZoomAsync()]).toEqual([["Loading the page.", "Page loaded."], "100%"]);
  });

  for (const [mode, isForced] of [[ThemeMode.Light, false], [ThemeMode.Dark, false], [ThemeMode.Dark, true]] as const) {
    it(`sets Zoom's percent at its row's end in the muted text, with no submenu chevron, its row lined up with the others, in the ${isForced ? "forced colours" : mode} look`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      if (isForced)
        await ForcedColorsFixture.activateAsync();
      await loadAsync("https://one.example/");
      const [copy, , , zoom] = await openMenuAsync();
      await measuredAsync();
      const part = (row: Element | undefined, selector: string): HTMLElement => {
        const found: HTMLElement | null | undefined = row?.querySelector<HTMLElement>(selector);
        if (found === null || found === undefined)
          throw new Error(`The menu row has no ${selector}.`);
        return found;
      };
      const box = (row: Element | undefined, selector: string): DOMRect => part(row, selector).getBoundingClientRect();
      if (zoom === undefined || copy === undefined)
        throw new Error("The menu has no Copy address or Zoom row.");
      const [row, other] = [zoom.getBoundingClientRect(), copy.getBoundingClientRect()];
      const [icon, label, percent] = [box(zoom, ".nol-menu-item-icon"), box(zoom, ".nol-menu-item-label"), box(zoom, ".nol-menu-item-value")];

      expect([rem(row.height), rem(row.width), rem(icon.left - row.left), rem(label.left - row.left)])
        .toEqual([rem(other.height), rem(other.width), rem(box(copy, ".nol-menu-item-icon").left - other.left), rem(box(copy, ".nol-menu-item-label").left - other.left)]);
      AppearanceFixture.expectPixels(row.right - percent.right, icon.left - row.left);
      AppearanceFixture.expectPixels((percent.top + percent.bottom) / 2, (label.top + label.bottom) / 2);
      expect([percent.left >= label.right - 0.5, percent.width > 0, getComputedStyle(part(zoom, ".nol-menu-item-value")).color, zoom.querySelector(".nol-menu-item-chevron")])
        .toEqual([true, true, getComputedStyle(find(".muted")).color, null]);
    });
  }

  it("hands a copy or an external open that failed to the error handler", async () => {
    const copyFailure = new Error("No clipboard.");
    const openFailure = new Error("No browser.");
    clipboard.answer = () => Promise.reject(copyFailure);
    fixture.componentInstance.openLink.set(() => Promise.reject(openFailure));
    await loadAsync("https://one.example/");

    (await openMenuAsync())[0]?.click();
    await fixture.whenStable();
    (await openMenuAsync())[1]?.click();
    await fixture.whenStable();

    await vi.waitFor(() => expectErrors([copyFailure, openFailure]));
    expect(said.map(t => t[0])).toEqual(["Loading the page.", "Page loaded."]);
  });

  it("follows a new controller and stops following the old one", async () => {
    const next = new FakeWebViews().open("workspace-2");
    fixture.componentInstance.controller.set(new PaneController(next));
    await fixture.whenStable();
    await showAsync(state("https://old.example/"));

    expect(field().value).toBe("");
    next.emit(state("https://new.example/"));
    await fixture.whenStable();

    expect(field().value).toBe("https://new.example/");
  });

  it("hands the typed address to the pane on Enter, as the person typed it, and ignores an empty one", async () => {
    await userEvent.click(field());
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("  example.com/docs {Enter}");
    await fixture.whenStable();

    expect(fixture.componentInstance.entered).toEqual(["  example.com/docs "]);
  });

  it("shows the address it's given in place of the page's own, until the person edits it, again after Escape, and the page's once it's taken away", async () => {
    await loadAsync("https://one.example/");
    fixture.componentInstance.shownAddress.set("https://example.com/pricing");
    await fixture.whenStable();

    expect([field().value, element.querySelector(".nol-browser-toolbar-host")?.textContent, field().getAttribute("aria-label")])
      .toEqual(["https://example.com/pricing", "example.com", "https://example.com/pricing"]);
    await userEvent.click(field());
    field().select();
    await userEvent.keyboard("two.example");
    expect(field().value).toBe("two.example");
    await userEvent.keyboard("{Escape}");
    await fixture.whenStable();
    expect(field().value).toBe("https://example.com/pricing");

    fixture.componentInstance.shownAddress.set(null);
    await fixture.whenStable();
    expect(field().value).toBe("https://one.example/");
  });

  it("keeps the person's edit while the page changes, until Escape puts the page's address back", async () => {
    await loadAsync("https://one.example/");
    await userEvent.click(field());
    field().select();
    await userEvent.keyboard("two.example");
    await showAsync(state("https://one.example/#next"));

    expect(field().value).toBe("two.example");
    await userEvent.keyboard("{Escape}");
    await fixture.whenStable();

    expect([field().value, document.activeElement]).toEqual(["https://one.example/#next", field()]);
  });

  it("keeps an entered address over the page's own events until the pane went there, then follows the page", async () => {
    await loadAsync("https://one.example/");
    await userEvent.click(field());
    field().select();
    await userEvent.keyboard("two.example{Enter}");
    await showAsync(state("https://one.example/", true));
    await showAsync(state("https://one.example/", false, true));

    expect(field().value).toBe("two.example");
    fixture.componentInstance.toolbar().followPage(controller);
    await showAsync(state("https://two.example/", true));

    expect(field().value).toBe("https://two.example/");
  });

  it("keeps an address entered over a loading page, and marks it invalid when it is refused after the old load's events", async () => {
    await showAsync(state("https://one.example/", true));
    await userEvent.click(field());
    field().select();
    await userEvent.keyboard("localhost:3000{Enter}");
    await showAsync(state("https://one.example/", true));
    await showAsync(state("https://one.example/"));
    controller.refuseAddress(TypedAddressRefusal.Local);
    await fixture.whenStable();

    expect([field().value, field().getAttribute("aria-invalid"), field().getAttribute("aria-describedby")]).toEqual(["localhost:3000", "true", "notice-1"]);
  });

  it("names both the not-secure note and the notice while a refused address is marked invalid over an http page", async () => {
    await loadAsync("http://plain.example/");
    await userEvent.click(field());
    field().select();
    await userEvent.keyboard("file:///etc/hosts{Enter}");
    controller.refuseAddress(TypedAddressRefusal.NotWeb);
    await fixture.whenStable();
    const mark: HTMLElement | null = element.querySelector(".nol-browser-toolbar-security");

    expect(field().getAttribute("aria-describedby")).toBe(`${mark?.id} notice-1`);
  });

  it("follows the page only for its own controller, and keeps an edit made after Enter", async () => {
    await loadAsync("https://one.example/");
    await userEvent.click(field());
    field().select();
    await userEvent.keyboard("two.example{Enter}");
    fixture.componentInstance.toolbar().followPage(new PaneController(null));
    await fixture.whenStable();

    expect(field().value).toBe("two.example");
    await userEvent.keyboard("/more");
    fixture.componentInstance.toolbar().followPage(controller);
    await fixture.whenStable();

    expect(field().value).toBe("two.example/more");
  });

  it("leaves Enter and Escape to an input method while it composes", async () => {
    await loadAsync("https://one.example/");
    await userEvent.click(field());
    field().select();
    await userEvent.keyboard("two.example");
    field().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }));
    field().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", isComposing: true, bubbles: true }));
    await fixture.whenStable();

    expect([fixture.componentInstance.entered, field().value]).toEqual([[], "two.example"]);
  });

  it("leaves Enter and Escape with Shift, Ctrl, Alt or Cmd held to the window, as a plain key's only", async () => {
    await loadAsync("https://one.example/");
    await userEvent.click(field());
    field().select();
    await userEvent.keyboard("two.example");
    for (const modifier of [{ shiftKey: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
      field().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, ...modifier }));
      field().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, ...modifier }));
    }
    await fixture.whenStable();

    expect([fixture.componentInstance.entered, field().value]).toEqual([[], "two.example"]);
  });

  it("keeps a refused address, marked invalid, so the person can correct it; Escape puts the page's address back and takes the refusal away", async () => {
    await loadAsync("https://one.example/");
    await userEvent.click(field());
    field().select();
    await userEvent.keyboard("file:///etc/hosts{Enter}");
    controller.refuseAddress(TypedAddressRefusal.NotWeb);
    await fixture.whenStable();

    expect([field().value, field().getAttribute("aria-invalid")]).toEqual(["file:///etc/hosts", "true"]);
    await userEvent.keyboard("{Escape}");
    await fixture.whenStable();

    expect([field().value, field().getAttribute("aria-invalid"), controller.status.refusedAddress]).toEqual(["https://one.example/", null, null]);
  });

  it("follows the page again once the pane went to an entered address that the origin check refused", async () => {
    await loadAsync("https://one.example/");
    await userEvent.click(field());
    field().select();
    await userEvent.keyboard("refused.example{Enter}");
    await showAsync(new ViewRefusalEvent("https://refused.example/", "https://refused.example", false));

    expect(field().value).toBe("refused.example");
    fixture.componentInstance.toolbar().followPage(controller);
    await fixture.whenStable();

    expect([field().value, field().getAttribute("aria-invalid")]).toEqual(["https://one.example/", null]);
  });

  it("drops the edit when the controller changes, as another tab shows", async () => {
    await userEvent.click(field());
    await userEvent.keyboard("draft.example");
    fixture.componentInstance.controller.set(new PaneController(new FakeWebViews().open("workspace-2")));
    await fixture.whenStable();

    expect(field().value).toBe("");
  });

  it("moves the focus into the address field when asked", async () => {
    fixture.componentInstance.toolbar().focusAddress();

    expect(document.activeElement).toBe(field());
  });

  function isShown(target: Element): boolean {
    return target.getClientRects().length > 0;
  }

  async function sizeAsync(width: number, panelSize?: number): Promise<void> {
    fixture.componentInstance.width.set(AppearanceFixture.toPixels(width, panelSize));
    await fixture.whenStable();
    await vi.waitFor(() => expect(isShown(field())).toBe(width >= 16));
    await measuredAsync();
  }

  async function revealAsync(): Promise<void> {
    fixture.componentInstance.toolbar().focusAddress();
    await vi.waitFor(() => expect(document.activeElement).toBe(field()));
    await fixture.whenStable();
  }

  for (const mode of [ThemeMode.Light, ThemeMode.Dark]) {
    it(`keeps the address field on the buttons' line from 20rem down to 16rem, 0.375rem from Reload and from More, shrinking as the toolbar narrows, and hides it below 16rem, in the ${mode} theme`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      await loadAsync("https://one.example/page");
      const seen: [number, boolean, number, number, number, boolean][] = [];

      for (const width of [20, 16]) {
        await sizeAsync(width);
        const boxOf = (target: Element | null): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
        const [host, back, reload, more, address] = [boxOf(element.querySelector("nol-browser-toolbar")), boxOf(button("Back")), boxOf(button("Reload", "Stop")), boxOf(button("More")),
          boxOf(element.querySelector(".nol-browser-toolbar-address"))];
        seen.push([width, address.top < back.bottom && address.bottom > back.top, rem(address.left - reload.right), rem(more.left - address.right),
          rem(host.height - LOADING_BAR_HEIGHT), rem(field().getBoundingClientRect().width) >= 2.5]);
      }
      await sizeAsync(15.75);
      const row = element.querySelector(".nol-browser-toolbar-row");

      expect(seen).toEqual([[20, true, 0.375, 0.375, 2.5, true], [16, true, 0.375, 0.375, 2.5, true]]);
      expect([isShown(field()), [button("Back"), button("Forward"), button("Reload", "Stop"), button("More")].map(t => isShown(t)), row === null ? null : rem(row.getBoundingClientRect().height)])
        .toEqual([false, [true, true, true, true], 2.5]);
    });
  }

  it("shrinks the address field as the toolbar narrows from 20rem to 16rem", async () => {
    await loadAsync("https://one.example/");
    const widthAsync = async (width: number): Promise<number> => {
      await sizeAsync(width);
      return field().getBoundingClientRect().width;
    };

    const wide: number = await widthAsync(20);
    const middle: number = await widthAsync(18);
    const narrow: number = await widthAsync(16);

    expect([wide > middle, middle > narrow]).toEqual([true, true]);
  });

  it("offers Edit address first in More below 16rem only, which shows the field across the row in place of the buttons, its whole address selected", async () => {
    await loadAsync("https://one.example/page");
    await sizeAsync(16);
    const wide = labels(await openMenuAsync())[0];
    await userEvent.keyboard("{Escape}");
    await fixture.whenStable();
    await sizeAsync(15.75);
    const narrow = labels(await openMenuAsync())[0];

    items()[0]?.click();
    await vi.waitFor(() => expect(document.activeElement).toBe(field()));
    await fixture.whenStable();
    const host = element.querySelector("nol-browser-toolbar")?.getBoundingClientRect() ?? new DOMRect();
    const address = element.querySelector(".nol-browser-toolbar-address")?.getBoundingClientRect() ?? new DOMRect();

    expect([wide, narrow]).toEqual([["content_copy", "Copy address", null], ["edit", "Edit address", null]]);
    expect([[button("Back"), button("Forward"), button("Reload", "Stop"), button("More")].map(t => isShown(t)), rem(address.left - host.left), rem(host.right - address.right),
      field().selectionStart, field().selectionEnd, field().value.length]).toEqual([[false, false, false, false], 0.375, 0.375, 0, field().value.length, "https://one.example/page".length]);
  });

  it("ends the narrow toolbar's edit on Escape and on Enter, hiding the field and moving the focus to More, and on the field's blur", async () => {
    await loadAsync("https://one.example/");
    await sizeAsync(15.75);
    const ends: [boolean, boolean, boolean][] = [];
    const end = (): [boolean, boolean, boolean] => [isShown(field()), isShown(button("Back")), document.activeElement === button("More")];

    await revealAsync();
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => expect(document.activeElement).toBe(button("More")));
    ends.push(end());
    await revealAsync();
    await userEvent.keyboard("two.example{Enter}");
    await vi.waitFor(() => expect(document.activeElement).toBe(button("More")));
    ends.push(end());
    await revealAsync();
    field().blur();
    await fixture.whenStable();
    ends.push(end());

    expect([ends, fixture.componentInstance.entered]).toEqual([[[false, true, true], [false, true, true], [false, true, false]], ["two.example"]]);
  });

  it("selects the whole address again when asked while the narrow toolbar's field already shows", async () => {
    await loadAsync("https://one.example/");
    await sizeAsync(15.75);
    await revealAsync();
    field().setSelectionRange(3, 3);

    fixture.componentInstance.toolbar().focusAddress();

    expect([document.activeElement === field(), field().selectionStart, field().selectionEnd]).toEqual([true, 0, field().value.length]);
  });

  it("keeps a long address's start in view as the address key selects it, at full width and below 16rem", async () => {
    await loadAsync(LONG);
    const seen: [number, number | null, number | null, string | null][] = [];

    fixture.componentInstance.toolbar().focusAddress();
    seen.push([field().scrollLeft, field().selectionStart, field().selectionEnd, field().selectionDirection]);
    field().blur();
    await sizeAsync(15.75);
    await revealAsync();
    seen.push([field().scrollLeft, field().selectionStart, field().selectionEnd, field().selectionDirection]);

    expect(seen).toEqual([[0, 0, LONG.length, "backward"], [0, 0, LONG.length, "backward"]]);
  });

  it("keeps its Tab order below 16rem: the buttons, then More, with the field behind it", async () => {
    await showAsync(state("http://plain.example/page", false, true));
    await sizeAsync(10);
    button("Back").focus();
    const order: (Element | null)[] = [document.activeElement];

    for (const shift of [false, true]) {
      await userEvent.tab({ shift });
      await fixture.whenStable();
      order.push(document.activeElement);
    }

    expect(order).toEqual([button("Back"), button("More"), button("Back")]);
  });

  for (const [panelSize, zoom, name] of [[13, 1, ""], [12, 1, " at the smallest panel text size"], [18, 1, " at the largest panel text size"], [13, 2, " at 200% zoom"]] as const) {
    it(`fits at the pane's smallest width, 10rem${name}: Back, Forward, Reload and More on one line, and while edited the field across the row with "Not secure" whole, nothing overlapping`, async () => {
      const ratio = devicePixelRatio;
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, panelSize);
      await ZoomFixture.zoomAsync(zoom);
      await vi.waitFor(() => expect(devicePixelRatio).toBe(ratio * zoom));
      await showAsync(state("http://plain.example/page"));
      await sizeAsync(10, panelSize);
      const host = element.querySelector<HTMLElement>("nol-browser-toolbar");
      const row = element.querySelector<HTMLElement>(".nol-browser-toolbar-row");
      if (host === null || row === null)
        throw new Error("The toolbar isn't shown.");
      const box = host.getBoundingClientRect();
      const [back, more] = [button("Back").getBoundingClientRect(), button("More").getBoundingClientRect()];
      const buttons = [back, button("Forward").getBoundingClientRect(), button("Reload", "Stop").getBoundingClientRect(), more];
      const inset = AppearanceFixture.toPixels(0.375, panelSize);

      AppearanceFixture.expectPixels(box.width, AppearanceFixture.toPixels(10, panelSize));
      AppearanceFixture.expectPixels(box.height, AppearanceFixture.toPixels(2.5, panelSize) + LOADING_BAR_HEIGHT);
      for (const part of buttons) {
        AppearanceFixture.expectPixels(part.top, back.top);
        AppearanceFixture.expectPixels(part.width, AppearanceFixture.toPixels(1.5, panelSize));
      }
      AppearanceFixture.expectPixels(back.left - box.left, inset);
      AppearanceFixture.expectPixels(box.right - more.right, inset);
      expect([
        buttons.some((t, i) => buttons.slice(i + 1).some(u => overlaps(t, u))),
        [host.scrollWidth <= host.clientWidth, row.scrollWidth <= row.clientWidth],
        buttons.map(t => hasTargetSize(t, buttons.filter(u => u !== t)))
      ]).toEqual([false, [true, true], [true, true, true, true]]);

      await revealAsync();
      const mark = element.querySelector<HTMLElement>(".nol-browser-toolbar-security");
      const address = element.querySelector<HTMLElement>(".nol-browser-toolbar-address");
      if (mark === null || address === null)
        throw new Error("The field isn't shown.");
      const [markBox, fieldBox] = [mark.getBoundingClientRect(), field().getBoundingClientRect()];
      const inside = AppearanceFixture.toPixels(0.25, panelSize) + Number.parseFloat(getComputedStyle(address).borderLeftWidth);

      AppearanceFixture.expectPixels(box.height, AppearanceFixture.toPixels(2.5, panelSize) + LOADING_BAR_HEIGHT);
      AppearanceFixture.expectPixels(markBox.left - box.left, inset + inside);
      AppearanceFixture.expectPixels(box.right - fieldBox.right, inset + inside);
      AppearanceFixture.expectPixels(fieldBox.left - markBox.right, AppearanceFixture.toPixels(0.25, panelSize));
      expect([
        mark.scrollWidth <= mark.clientWidth,
        fieldBox.width >= AppearanceFixture.toPixels(2.5, panelSize),
        [markBox, fieldBox].every(t => t.left >= box.left - 0.5 && t.right <= box.right + 0.5),
        [host.scrollWidth <= host.clientWidth, row.scrollWidth <= row.clientWidth]
      ]).toEqual([true, true, true, [true, true]]);
    });
  }

  it("follows the panel text size across 16rem while the pane keeps its width in pixels", async () => {
    await loadAsync("https://one.example/");
    await sizeAsync(16);
    const shown: boolean[] = [];

    for (const panelSize of [14, 12]) {
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, panelSize);
      await vi.waitFor(() => expect(isShown(field())).toBe(panelSize < 13));
      shown.push(isShown(field()));
    }

    expect([shown, fixture.componentInstance.width()]).toEqual([[false, true], AppearanceFixture.toPixels(16)]);
  });

  it("keeps an http page's field at least 2.5rem wide from 20rem down to 16rem and back, \"Not secure\" showing its glyph alone where its words would leave less", async () => {
    await loadAsync("http://plain.example/page");
    const seen: [number, boolean][] = [];
    const words: boolean[] = [];

    for (const width of [20, 18, 17, 16, 20]) {
      await sizeAsync(width);
      seen.push([width, rem(field().getBoundingClientRect().width) >= 2.5]);
      words.push(find(".nol-browser-toolbar-words").getBoundingClientRect().width > 0);
    }

    expect([seen, words[0], words[3], words[4]]).toEqual([[[20, true], [18, true], [17, true], [16, true], [20, true]], true, false, true]);
  });

  it("draws an http page's \"Not secure\" at its width from the first frame after a navigation from https at 16.5rem, and after Edit address below 16rem", async () => {
    const nextFrameAsync = (): Promise<void> => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const words = (): number => find(".nol-browser-toolbar-words").getBoundingClientRect().width;
    await loadAsync("https://one.example/");
    await sizeAsync(16.5);

    view.emit(state("http://plain.example/page"));
    await nextFrameAsync();
    const navigated: [boolean, number] = [rem(field().getBoundingClientRect().width) >= 2.5, words()];
    await sizeAsync(15.75);
    fixture.componentInstance.toolbar().focusAddress();
    await nextFrameAsync();
    const revealed: [boolean, boolean] = [rem(field().getBoundingClientRect().width) >= 2.5, words() > 0];

    expect([navigated, revealed]).toEqual([[true, 0], [true, true]]);
  });

  it("keeps \"Not secure\" as the glyph-alone field's description and tooltip, and drops the glyph-alone look for an https page", async () => {
    await loadAsync("http://plain.example/page");
    await sizeAsync(16);
    const security = find(".nol-browser-toolbar-security");
    const described = field().getAttribute("aria-describedby");

    await PointerFixture.hoverAsync(security);
    await vi.waitFor(() => expect([...document.querySelectorAll(".cdk-overlay-container nol-tooltip")].some(t => t.textContent?.trim() === "Not secure")).toBe(true));
    await loadAsync("https://one.example/");
    await measuredAsync();

    expect([security.textContent, described?.split(" ").includes(security.id), element.querySelector(".nol-browser-toolbar-address-compact")]).toEqual(["no_encryptionNot secure", true, null]);
  });

  it("marks an http page on the narrow row with \"Not secure\"'s glyph beside More, named and with a tooltip, and hides it while the field shows", async () => {
    await showAsync(state("http://plain.example/page"));
    await sizeAsync(10);
    const mark = find(".nol-browser-toolbar-mark");
    const [box, more] = [mark.getBoundingClientRect(), button("More").getBoundingClientRect()];
    const others = [button("Back"), button("Forward"), button("Reload", "Stop"), button("More")].map(t => t.getBoundingClientRect());

    expect([mark.getAttribute("role"), mark.getAttribute("aria-label"), rem(more.left - box.right), rem(box.width), others.some(t => overlaps(t, box))]).toEqual(["img", "Not secure", 0.25, 1, false]);
    await PointerFixture.hoverAsync(mark);
    await vi.waitFor(() => expect([...document.querySelectorAll(".cdk-overlay-container nol-tooltip")].some(t => t.textContent?.trim() === "Not secure")).toBe(true));
    await revealAsync();
    const hidden = isShown(mark);
    await showAsync(state("https://one.example/"));

    expect([hidden, element.querySelector(".nol-browser-toolbar-mark")]).toEqual([false, null]);
  });

  it("keeps the field's edges under forced colours: a Highlight ring twice the border's width while edited, and a dashed edge in the system's text colour on a refused address, whose contents keep their place", async () => {
    await loadAsync("https://one.example/");
    await measuredAsync();
    const address: HTMLElement = find(".nol-browser-toolbar-address");
    const border: number = Number.parseFloat(getComputedStyle(address).borderLeftWidth);
    const inset = (): number => rem((address.firstElementChild?.getBoundingClientRect().left ?? Number.NaN) - address.getBoundingClientRect().left);
    const shown: number = inset();
    await ForcedColorsFixture.activateAsync();
    await userEvent.click(field());
    await fixture.whenStable();
    const edited: CSSStyleDeclaration = getComputedStyle(address);

    expect([edited.outlineStyle, rem(Number.parseFloat(edited.outlineWidth)), edited.outlineOffset, edited.outlineColor, inset()])
      .toEqual(["solid", rem(border * 2), "0px", ForcedColorsFixture.resolve("Highlight"), shown]);
    field().select();
    await userEvent.keyboard("file:///etc/hosts{Enter}");
    controller.refuseAddress(TypedAddressRefusal.NotWeb);
    await fixture.whenStable();
    const refused: CSSStyleDeclaration = getComputedStyle(address);
    const text: string = ForcedColorsFixture.resolve("CanvasText");

    expect([refused.borderTopStyle, refused.borderRightStyle, refused.borderBottomStyle, refused.borderLeftStyle]).toEqual(["dashed", "dashed", "dashed", "dashed"]);
    expect([refused.borderTopWidth, refused.borderRightWidth, refused.borderBottomWidth, refused.borderLeftWidth].map(t => rem(Number.parseFloat(t))))
      .toEqual([rem(border * 2), rem(border * 2), rem(border * 2), rem(border * 2)]);
    expect([refused.borderTopColor, refused.borderRightColor, refused.borderBottomColor, refused.borderLeftColor, inset()]).toEqual([text, text, text, text, shown]);
  });

  for (const mode of [ThemeMode.Light, ThemeMode.Dark]) {
    it(`lays out the toolbar in rem, with the field in the input's colours and the accent while edited, in the ${mode} theme`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      await showAsync(state("https://docs.example.com/pricing"));
      await measuredAsync();
      const box = find("nol-browser-toolbar").getBoundingClientRect();
      const row = find(".nol-browser-toolbar-row").getBoundingClientRect();
      const address = find(".nol-browser-toolbar-address");
      const place = address.getBoundingClientRect();
      const lock = find(".nol-browser-toolbar-address > .nol-browser-toolbar-glyph").getBoundingClientRect();
      const back = button("Back").getBoundingClientRect();
      const forward = button("Forward").getBoundingClientRect();
      const reload = button("Reload", "Stop").getBoundingClientRect();
      const more = button("More").getBoundingClientRect();
      const border = Number.parseFloat(getComputedStyle(address).borderLeftWidth);
      const [probe, muted] = [getComputedStyle(find(".probe")), getComputedStyle(find(".muted"))];
      const style = getComputedStyle(address);

      expect([rem(row.height), rem(back.left - box.left), rem(box.right - more.right), rem(forward.left - back.right), rem(reload.left - forward.right)]).toEqual([2.5, 0.375, 0.375, 0.125, 0.125]);
      expect([rem(place.left - reload.right), rem(more.left - place.right), rem(lock.left - place.left - border), rem(field().getBoundingClientRect().left - lock.right)])
        .toEqual([0.375, 0.375, 0.5, 0.375]);
      AppearanceFixture.expectPixels(place.right - border - find(".nol-browser-toolbar-place").getBoundingClientRect().right, AppearanceFixture.toPixels(0.5));
      AppearanceFixture.expectPixels(place.height, Number.parseFloat(muted.height));
      AppearanceFixture.expectPixels(place.top - row.top, row.bottom - place.bottom);
      expect([style.backgroundColor, style.borderTopColor, style.borderTopLeftRadius, getComputedStyle(find(".nol-browser-toolbar-host")).color, getComputedStyle(find(".nol-browser-toolbar-path")).color])
        .toEqual([probe.backgroundColor, probe.borderTopColor, muted.borderTopLeftRadius, probe.color, muted.color]);
      await userEvent.click(field());
      await fixture.whenStable();

      expect([getComputedStyle(address).borderTopColor, getComputedStyle(address).outlineColor, getComputedStyle(address).outlineStyle]).toEqual([probe.outlineColor, probe.outlineColor, "solid"]);
    });
  }

  for (const [mode, isForced] of [[ThemeMode.Light, false], [ThemeMode.Dark, false], [ThemeMode.Dark, true]] as const) {
    it(`draws the address once in every state of the field, in the ${isForced ? "forced colours" : mode} look`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      if (isForced)
        await ForcedColorsFixture.activateAsync();
      const place = (): DOMRect => find(".nol-browser-toolbar-place").getBoundingClientRect();
      const inkAsync = async (): Promise<[number, number]> => {
        await measuredAsync();
        const box: DOMRect = place();
        const image = new Image();
        image.src = `data:image/png;base64,${await page.screenshot({ element: find(".nol-browser-toolbar-place"), save: false })}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        [canvas.width, canvas.height] = [image.width, image.height];
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context === null)
          throw new Error("The canvas has no 2D context.");
        context.drawImage(image, 0, 0);
        const pixels: Uint8ClampedArray = context.getImageData(0, 0, image.width, image.height).data;
        const empty: number = (Math.floor(image.height / 2) * image.width + image.width - 1) * 4;
        const background: number[] = [pixels[empty] ?? 0, pixels[empty + 1] ?? 0, pixels[empty + 2] ?? 0];
        const drawn: number[] = [];
        for (let x = 0; x < image.width; x++)
          for (let y = 0; y < image.height; y++) {
            const at: number = (y * image.width + x) * 4;
            if (background.some((t, i) => Math.abs((pixels[at + i] ?? 0) - t) > 64)) {
              drawn.push(x);
              break;
            }
          }
        const scale: number = image.width / box.width;
        return [(drawn[0] ?? Number.NaN) / scale, ((drawn.at(-1) ?? Number.NaN) + 1) / scale];
      };
      const layer = (): [number, number] => {
        const range = document.createRange();
        range.selectNodeContents(find(".nol-browser-toolbar-shown"));
        const text: DOMRect = range.getBoundingClientRect();
        return [text.left - place().left, text.right - place().left];
      };
      const own = (): [number, number] => {
        const probe: HTMLSpanElement = find(".nol-browser-toolbar-place").appendChild(document.createElement("span"));
        probe.style.cssText = "position: absolute; visibility: hidden; white-space: pre";
        probe.textContent = field().value;
        const width: number = probe.getBoundingClientRect().width;
        probe.remove();
        const left: number = field().getBoundingClientRect().left - place().left;
        return [left, left + width];
      };
      const misdrawn: [string, number[]][] = [];
      const checkAsync = async (name: string, text: () => [number, number]): Promise<void> => {
        const [inkLeft, inkRight] = await inkAsync();
        const [textLeft, textRight] = text();
        if (!(Math.abs(inkLeft - textLeft) <= 2 && Math.abs(inkRight - textRight) <= 2))
          misdrawn.push([name, [inkLeft, inkRight, textLeft, textRight].map(t => Math.round(t * 10) / 10)]);
      };
      const checkRestingAsync = async (name: string): Promise<void> => {
        await checkAsync(name, layer);
        const shown: HTMLElement = find(".nol-browser-toolbar-shown");
        shown.style.visibility = "hidden";
        const [inkLeft, inkRight] = await inkAsync();
        shown.style.visibility = "";
        if (!Number.isNaN(inkLeft))
          misdrawn.push([`${name}, the input's own text`, [inkLeft, inkRight].map(t => Math.round(t * 10) / 10)]);
      };
      await loadAsync("https://example.com/");
      await checkRestingAsync("resting");
      await userEvent.click(field());
      await fixture.whenStable();
      await checkAsync("focused, all of it selected", own);
      field().dispatchEvent(new FocusEvent("blur"));
      await fixture.whenStable();
      await checkRestingAsync("resting while the window's focus is elsewhere, the field still focused in it with its selection");
      await loadAsync("https://example.com/next");
      await checkRestingAsync("after the page's own navigation while the window's focus is elsewhere");
      field().dispatchEvent(new FocusEvent("focus"));
      await fixture.whenStable();
      await checkAsync("focused again as the window takes the focus back", own);
      await userEvent.keyboard("exa");
      await fixture.whenStable();
      await checkAsync("while typing", own);
      await userEvent.keyboard("{Escape}");
      await fixture.whenStable();
      await checkAsync("focused after Escape puts back the page's address", own);
      field().blur();
      await fixture.whenStable();
      await checkRestingAsync("resting after the field gives up the focus");

      expect([document.activeElement === field(), misdrawn]).toEqual([false, []]);
    });
  }
});

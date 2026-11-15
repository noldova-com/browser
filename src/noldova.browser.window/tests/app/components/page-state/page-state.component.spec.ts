/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { AnnouncementPoliteness, Announcer, ClipboardWriter, DefaultTheme, ThemeMode, TooltipDirective } from "@noldova/ui.components.angular";
import { AppearanceFixture, ClipboardWriterFixture, PointerFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PageStateComponent } from "../../../../src/app/components/page-state/page-state.component.ts";
import { RefusedPage } from "../../../../src/app/models/refused-page.ts";
import { ViewCrashEvent } from "../../../../src/app/models/view-crash-event.ts";
import type { ViewEvent } from "../../../../src/app/models/view-event.ts";
import { ViewLoadFailureEvent } from "../../../../src/app/models/view-load-failure-event.ts";
import { ViewRefusalEvent } from "../../../../src/app/models/view-refusal-event.ts";
import { ViewStateEvent } from "../../../../src/app/models/view-state-event.ts";
import { PaneController } from "../../../../src/app/services/pane-controller.ts";
import { AccessibilityTreeFixture } from "../../../fixtures/accessibility-tree.fixture.ts";
import { FakeWebView, FakeWebViews } from "../../../fixtures/fake-web-views.fixture.ts";
import { ForcedColorsFixture } from "../../../fixtures/forced-colors.fixture.ts";
import { ZoomFixture } from "../../../fixtures/zoom.fixture.ts";

@Component({
  imports: [PageStateComponent],
  template: `<div class="frame" style="width: 640px; height: 400px"><nol-browser-page-state [controller]="controller()" [isForgotten]="isForgotten()"
    [isElsewhere]="isElsewhere()" [refusal]="refusal()" (focusLeaving)="leaves = leaves + 1" (closed)="closes = closes + 1" (refusalAnswered)="answers.push($event)" /></div><div class="panel" style="background: var(--nol-panel); color: var(--nol-text-muted)"></div>`
})
class HostComponent {
  public readonly controller: WritableSignal<PaneController | null> = signal(new PaneController(null));
  public readonly isForgotten: WritableSignal<boolean> = signal(false);
  public readonly isElsewhere: WritableSignal<boolean> = signal(false);
  public readonly refusal: WritableSignal<RefusedPage | null> = signal(null);
  public readonly answers: (string | null)[] = [];
  public leaves: number = 0;
  public closes: number = 0;
}

describe("PageStateComponent", () => {
  const CANT_REACH: string = "The address may be mistyped, or the site is down.";
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;
  let view: FakeWebView;
  let errors: unknown[];
  let checkedErrors: number;
  let said: [string, AnnouncementPoliteness][];
  let clipboard: ClipboardWriterFixture;

  function expectErrors(expected: readonly unknown[]): void {
    expect(errors).toEqual(expected);
    checkedErrors = errors.length;
  }

  function shown(): [string | undefined, string | undefined, (string | undefined)[], (string | undefined)[]] {
    return [
      element.querySelector(".nol-browser-page-state-glyph")?.textContent?.trim(),
      element.querySelector(".nol-browser-page-state-heading")?.textContent?.trim(),
      [...element.querySelectorAll(".nol-browser-page-state-detail")].map(t => t.textContent?.trim()),
      [...element.querySelectorAll("button")].map(t => t.textContent?.trim())
    ];
  }

  function find(selector: string): HTMLElement {
    const found: HTMLElement | null = element.querySelector<HTMLElement>(selector);
    if (found === null)
      throw new Error(`The state has no ${selector}.`);
    return found;
  }

  function button(index: number = 0): HTMLButtonElement {
    const found: HTMLButtonElement | undefined = [...element.querySelectorAll<HTMLButtonElement>("button.nol-browser-page-state-action")][index];
    if (found === undefined)
      throw new Error(`The state has no button ${index}.`);
    return found;
  }

  function rem(pixels: number): number {
    return Math.round(pixels / Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 10000) / 10000;
  }

  function state(canGoBack: boolean): ViewEvent {
    return new ViewStateEvent("https://one.example/", "One", false, canGoBack, false);
  }

  function failed(description: string, address: string = "https://docs.example.com/pricing"): ViewEvent {
    return new ViewLoadFailureEvent(address, -105, description);
  }

  async function showAsync(...events: ViewEvent[]): Promise<void> {
    for (const event of events)
      view.emit(event);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    errors = [];
    checkedErrors = 0;
    said = [];
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
      announce(message, politeness, options);
    });
    view = new FakeWebViews().open("workspace-1");
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.controller.set(new PaneController(view));
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

  it("asks for an address on an empty page, with no action", () => {
    expect(shown()).toEqual(["travel_explore", "Type an address to open a page", [], []]);
  });

  it("says it can't reach the page's host, why, and tries again", async () => {
    await showAsync(failed("ERR_NAME_NOT_RESOLVED"));

    expect(shown()).toEqual(["cloud_off", "Can't reach docs.example.com", [`${CANT_REACH} The server couldn't be found (DNS).`], ["Try again", "Copy address"]]);
    button().click();

    await vi.waitFor(() => expect(view.calls).toEqual(["reload"]));
    expect(fixture.componentInstance.leaves).toBe(1);
  });

  it("says why for each failure a person can act on, names any other, and names an address without a host whole", async () => {
    const details: (string | undefined)[] = [];
    for (const description of ["ERR_CONNECTION_REFUSED", "ERR_CONNECTION_TIMED_OUT", "ERR_TIMED_OUT", "ERR_INTERNET_DISCONNECTED", "ERR_ADDRESS_UNREACHABLE", "ERR_FAILED"]) {
      await showAsync(failed(description));
      details.push(shown()[2][0]);
    }
    await showAsync(failed("ERR_FAILED", "data:text/html,page"));

    expect(details).toEqual([
      `${CANT_REACH} The server refused the connection.`, `${CANT_REACH} The server took too long to answer.`, `${CANT_REACH} The server took too long to answer.`,
      `${CANT_REACH} This computer isn't connected to the internet.`, `${CANT_REACH} The server's address can't be reached from this network.`,
      `${CANT_REACH} The page didn't load (ERR_FAILED).`
    ]);
    expect(shown()[1]).toBe("Can't reach data:text/html,page");
  });

  it("copies the address of a page it can't reach through the window's clipboard, and says so", async () => {
    await showAsync(failed("ERR_NAME_NOT_RESOLVED"));

    button(1).click();

    await vi.waitFor(() => expect(said.at(-1)).toEqual(["Address copied.", AnnouncementPoliteness.Polite]));
    expect([clipboard.texts, view.calls, fixture.componentInstance.leaves]).toEqual([["https://docs.example.com/pricing"], [], 0]);
  });

  it("says the address wasn't copied when the window's clipboard refuses it", async () => {
    clipboard.answer = () => Promise.resolve(false);
    await showAsync(failed("ERR_NAME_NOT_RESOLVED"));

    button(1).click();

    await vi.waitFor(() => expect(said.at(-1)).toEqual(["The address wasn't copied.", AnnouncementPoliteness.Polite]));
    expect([clipboard.texts, fixture.componentInstance.leaves]).toEqual([["https://docs.example.com/pricing"], 0]);
  });

  it("names the origin Browser refused, and goes back only while the tab has history", async () => {
    await showAsync(state(false), new ViewRefusalEvent("https://blocked.example/page", "https://blocked.example", false));

    expect(shown()).toEqual(["block", "Browser doesn't open https://blocked.example", ["Its address isn't one Browser opens."], []]);
    await showAsync(state(true), new ViewRefusalEvent("https://other.example/", "https://other.example", false));

    expect(shown()[3]).toEqual(["Back"]);
    button().click();

    await vi.waitFor(() => expect(view.calls).toEqual(["back"]));
    expect(fixture.componentInstance.leaves).toBe(1);
  });

  it("says a page stopped working, and reloads it", async () => {
    await showAsync(state(false), new ViewCrashEvent());

    expect(shown()).toEqual(["sentiment_dissatisfied", "This page stopped working", ["Its content process ended. Reload to open it again; anything typed into it is lost."], ["Reload"]]);
    button().click();

    await vi.waitFor(() => expect(view.calls).toEqual(["reload"]));
    expect(fixture.componentInstance.leaves).toBe(1);
  });

  it("says a page the module no longer knows can't open again, and closes it, keeping the focus", async () => {
    fixture.componentInstance.controller.set(null);
    fixture.componentInstance.isForgotten.set(true);
    await fixture.whenStable();

    expect(shown()).toEqual(["history", "This page can't open again",
      ["Browser no longer knows which workspace it belonged to. Close it, and open the page again from where you found it."], ["Close"]]);
    button().focus();
    button().click();
    await fixture.whenStable();

    expect([fixture.componentInstance.closes, fixture.componentInstance.leaves]).toEqual([1, 0]);
  });

  it("says another window has the page, what to do, and closes this tab, keeping the focus", async () => {
    fixture.componentInstance.controller.set(null);
    fixture.componentInstance.isElsewhere.set(true);
    await fixture.whenStable();

    expect(shown()).toEqual(["tab", "This page moved to another window",
      ["A page shows in one window at a time. Open it again from where you found it to show it here, or close this tab."], ["Close"]]);
    button().focus();
    button().click();
    await fixture.whenStable();

    expect([fixture.componentInstance.closes, fixture.componentInstance.leaves]).toEqual([1, 0]);
  });

  it("puts a denied site's state in a heading, a paragraph and its two buttons, in the accessibility tree", async () => {
    await showAsync(state(true));
    fixture.componentInstance.refusal.set(new RefusedPage("Scout", "https://docs.example.com/pricing", "https://docs.example.com"));
    await fixture.whenStable();

    expect(await AccessibilityTreeFixture.readAsync(find(".frame"))).toEqual([
      "heading \"Scout can't open docs.example.com\" level=2",
      "paragraph",
      "  StaticText \"This address isn't among the sites this workspace allows. Scout asked to open it; you can allow it, or type it yourself to open it.\"",
      "button \"Allow this site for the workspace\"",
      "button \"Not now\""
    ]);
  });

  for (const zoom of [1, 2]) {
    it(`fits the pane's smallest width, 10rem${zoom === 2 ? ", at 200% zoom" : ""}: the heading, detail and buttons inside the state, at least 24 pixels tall, and nothing scrolling sideways`, async () => {
      const ratio: number = devicePixelRatio;
      await ZoomFixture.zoomAsync(zoom);
      await vi.waitFor(() => expect(devicePixelRatio).toBe(ratio * zoom));
      find(".frame").style.width = `${AppearanceFixture.toPixels(10)}px`;
      await showAsync(state(true), failed("ERR_NAME_NOT_RESOLVED"));
      const failing: string[] = fits();
      fixture.componentInstance.refusal.set(new RefusedPage("Scout", "https://docs.example.com/pricing", "https://docs.example.com"));
      await fixture.whenStable();

      expect([failing, fits()]).toEqual([[], []]);
    });
  }

  const buttonStates: readonly (readonly [string, () => Promise<void>])[] = [
    ["a page the module no longer knows", async () => {
      fixture.componentInstance.controller.set(null);
      fixture.componentInstance.isForgotten.set(true);
      await fixture.whenStable();
    }],
    ["a page another window has", async () => {
      fixture.componentInstance.controller.set(null);
      fixture.componentInstance.isElsewhere.set(true);
      await fixture.whenStable();
    }],
    ["a denied site", async () => {
      fixture.componentInstance.refusal.set(new RefusedPage("Scout", "https://docs.example.com/pricing", "https://docs.example.com"));
      await fixture.whenStable();
    }],
    ["a page that didn't load", () => showAsync(failed("ERR_NAME_NOT_RESOLVED"))],
    ["a refused page with history", () => showAsync(state(true), new ViewRefusalEvent("https://other.example/", "https://other.example", false))],
    ["a page that stopped working", () => showAsync(state(false), new ViewCrashEvent())]
  ];

  function tooltips(): (string | undefined)[] {
    return [...document.querySelectorAll(".cdk-overlay-container nol-tooltip")].map(t => t.textContent?.trim());
  }

  function tooltipOf(target: HTMLButtonElement): TooltipDirective {
    const found: TooltipDirective | undefined = fixture.debugElement.queryAll(By.directive(TooltipDirective)).find(t => t.nativeElement === target)?.injector.get(TooltipDirective);
    if (found === undefined)
      throw new Error("The button has no tooltip.");
    return found;
  }

  function labelOf(target: HTMLButtonElement): HTMLElement {
    const found: HTMLElement | null = target.querySelector<HTMLElement>("[data-truncates]");
    if (found === null)
      throw new Error("The button has no label that the kit cuts.");
    return found;
  }

  function inside(part: DOMRect, box: DOMRect): boolean {
    return part.left >= box.left - 0.5 && part.right <= box.right + 0.5 && part.top >= box.top - 0.5 && part.bottom <= box.bottom + 0.5;
  }

  for (const [name, showStateAsync] of buttonStates)
    it(`gives each of ${name}'s buttons a tooltip of its own label, shown only while cut, keeps the buttons and their labels inside the state at 7rem, cuts a label that doesn't fit with an ellipsis, and shows it whole in the tooltip`, async () => {
      find(".frame").style.width = `${AppearanceFixture.toPixels(7)}px`;
      await showStateAsync();
      const box: DOMRect = find("nol-browser-page-state").getBoundingClientRect();
      const buttons: HTMLButtonElement[] = [...element.querySelectorAll<HTMLButtonElement>("button.nol-browser-page-state-action")];
      const cut: HTMLButtonElement[] = buttons.filter(t => labelOf(t).scrollWidth > labelOf(t).clientWidth);

      expect([buttons.length > 0, buttons.map(t => [tooltipOf(t).text(), tooltipOf(t).isTruncatedOnly()])]).toEqual([true, buttons.map(t => [t.textContent?.trim(), true])]);
      expect(buttons.map(t => [inside(t.getBoundingClientRect(), box), inside(labelOf(t).getBoundingClientRect(), t.getBoundingClientRect())]))
        .toEqual(buttons.map(() => [true, true]));
      expect(cut.map(t => getComputedStyle(labelOf(t)).textOverflow)).toEqual(cut.map(() => "ellipsis"));
      for (const target of cut) {
        await PointerFixture.hoverAsync(target);
        await vi.waitFor(() => expect(tooltips()).toContain(target.textContent?.trim()));
      }
    });

  it("cuts the denied site's long label at 7rem, so its tooltip is the one that shows", async () => {
    find(".frame").style.width = `${AppearanceFixture.toPixels(7)}px`;
    fixture.componentInstance.refusal.set(new RefusedPage("Scout", "https://docs.example.com/pricing", "https://docs.example.com"));
    await fixture.whenStable();
    const label: HTMLElement = labelOf(button());

    expect([label.scrollWidth > label.clientWidth, getComputedStyle(label).textOverflow]).toEqual([true, "ellipsis"]);
    await PointerFixture.hoverAsync(button());
    await vi.waitFor(() => expect(tooltips()).toContain("Allow this site for the workspace"));
  });

  it("shows no tooltip for a label that fits, as Not now does at 10rem, while the cut label beside it shows its own", async () => {
    find(".frame").style.width = `${AppearanceFixture.toPixels(10)}px`;
    fixture.componentInstance.refusal.set(new RefusedPage("Scout", "https://docs.example.com/pricing", "https://docs.example.com"));
    await fixture.whenStable();
    const notNow: HTMLButtonElement = button(1);
    const label: HTMLElement = labelOf(notNow);
    tooltipOf(notNow).show();
    const shownForUncut: (string | undefined)[] = tooltips();
    tooltipOf(button()).show();
    const allow: HTMLElement = labelOf(button());

    expect([notNow.textContent?.trim(), label.scrollWidth <= label.clientWidth, shownForUncut, allow.scrollWidth > allow.clientWidth]).toEqual(["Not now", true, [], true]);
    await vi.waitFor(() => expect(tooltips()).toEqual(["Allow this site for the workspace"]));
  });

  function fits(): string[] {
    const host: HTMLElement = find("nol-browser-page-state");
    const box: DOMRect = host.getBoundingClientRect();
    const parts: HTMLElement[] = [...host.querySelectorAll<HTMLElement>(".nol-browser-page-state-heading, .nol-browser-page-state-detail, button")];
    return [
      ...host.scrollWidth > host.clientWidth ? ["the state scrolls sideways"] : [],
      ...parts.flatMap(t => {
        const part: DOMRect = t.getBoundingClientRect();
        const name: string = t.textContent?.trim() ?? "";
        return [
          ...part.left < box.left - 0.5 || part.right > box.right + 0.5 ? [`${name} leaves the state`] : [],
          ...t.scrollWidth > t.clientWidth ? [`${name} is cut short`] : [],
          ...t instanceof HTMLButtonElement && part.height < 24 ? [`${name} is under 24 pixels tall`] : []
        ];
      })
    ];
  }

  it("says a teammate can't open a site the person denied, and why, and gives its address to allow or nothing for Not now", async () => {
    await showAsync(state(true));
    fixture.componentInstance.refusal.set(new RefusedPage("Scout", "https://docs.example.com/pricing", "https://docs.example.com"));
    await fixture.whenStable();

    expect(shown()).toEqual(["block", "Scout can't open docs.example.com",
      ["This address isn't among the sites this workspace allows. Scout asked to open it; you can allow it, or type it yourself to open it."],
      ["Allow this site for the workspace", "Not now"]]);
    button(0).focus();
    button(0).click();
    button(1).click();
    await fixture.whenStable();

    expect([fixture.componentInstance.answers, fixture.componentInstance.leaves, said.at(-1)])
      .toEqual([["https://docs.example.com/pricing", null], 0, ["Scout can't open docs.example.com", AnnouncementPoliteness.Polite]]);
  });

  it("names a teammate the app gave no name as a teammate on the page it couldn't open", async () => {
    fixture.componentInstance.refusal.set(new RefusedPage("", "https://docs.example.com/pricing", "https://docs.example.com"));
    await fixture.whenStable();

    expect(shown()[1]).toBe("A teammate can't open docs.example.com");
  });

  it("keeps the focus on the main action while another takes its place, and says the focus is leaving before a change takes the actions away", async () => {
    await showAsync(state(true), new ViewCrashEvent());
    const first = button();
    first.focus();
    await showAsync(failed("ERR_NAME_NOT_RESOLVED"));

    expect([shown()[3], button(), document.activeElement, fixture.componentInstance.leaves]).toEqual([["Try again", "Copy address"], first, first, 0]);
    await showAsync(new ViewRefusalEvent("https://other.example/", "https://other.example", false));

    expect([shown()[3], button(), fixture.componentInstance.leaves]).toEqual([["Back"], first, 0]);
    fixture.componentInstance.controller.set(new PaneController(new FakeWebViews().open("workspace-2")));
    await fixture.whenStable();

    expect([shown()[3], fixture.componentInstance.leaves]).toEqual([[], 1]);
  });

  it("leaves the focus alone when the actions go while the focus is elsewhere", async () => {
    await showAsync(state(false), new ViewCrashEvent());
    await showAsync(new ViewRefusalEvent("https://other.example/", "https://other.example", false));

    expect([shown()[3], fixture.componentInstance.leaves]).toEqual([[], 0]);
  });

  it("says Browser can't show pages without a view or a controller, with no action", async () => {
    fixture.componentInstance.controller.set(new PaneController(null));
    await fixture.whenStable();
    const withoutView = shown();
    fixture.componentInstance.controller.set(null);
    await fixture.whenStable();

    expect([withoutView, shown()]).toEqual([["web_asset_off", "Browser can't show pages here", [], []], ["web_asset_off", "Browser can't show pages here", [], []]]);
  });

  it("announces each new heading politely, once, without taking focus", async () => {
    const before = document.activeElement;
    await showAsync(state(false), new ViewCrashEvent());
    await showAsync(new ViewCrashEvent());

    expect([said, document.activeElement]).toEqual([[["Type an address to open a page", AnnouncementPoliteness.Polite], ["This page stopped working", AnnouncementPoliteness.Polite]], before]);
  });

  it("announces the heading again for another tab in the same state", async () => {
    fixture.componentInstance.controller.set(new PaneController(new FakeWebViews().open("workspace-2")));
    await fixture.whenStable();

    expect(said).toEqual([["Type an address to open a page", AnnouncementPoliteness.Polite], ["Type an address to open a page", AnnouncementPoliteness.Polite]]);
  });

  it("hands an action or a copy that failed to the error handler", async () => {
    const failure = new Error("The bridge is gone.");
    const copyFailure = new Error("No clipboard.");
    clipboard.answer = () => Promise.reject(copyFailure);
    await showAsync(failed("ERR_NAME_NOT_RESOLVED"));
    view.failNextCall(failure);

    button(1).click();
    button().click();

    await vi.waitFor(() => expectErrors([copyFailure, failure]));
  });

  it("follows a new controller and stops following the old one", async () => {
    const next = new FakeWebViews().open("workspace-2");
    fixture.componentInstance.controller.set(new PaneController(next));
    await fixture.whenStable();
    await showAsync(new ViewCrashEvent());

    expect(shown()[1]).toBe("Type an address to open a page");
    next.crash();
    await fixture.whenStable();

    expect(shown()[1]).toBe("This page stopped working");
  });

  it("keeps the page's state under forced colours: its sizes and gaps, the glyph centred, and the glyph, heading and detail in the system's text colour on its canvas", async () => {
    await showAsync(failed("ERR_NAME_NOT_RESOLVED"));
    await ForcedColorsFixture.activateAsync();
    const host: HTMLElement = find("nol-browser-page-state");
    const glyph: HTMLElement = find(".nol-browser-page-state-glyph");
    const heading: HTMLElement = find(".nol-browser-page-state-heading");
    const detail: HTMLElement = find(".nol-browser-page-state-detail");
    const box: DOMRect = host.getBoundingClientRect();
    const mark: DOMRect = glyph.getBoundingClientRect();
    const title: DOMRect = heading.getBoundingClientRect();
    const text: DOMRect = detail.getBoundingClientRect();
    const actions: DOMRect = find(".nol-browser-page-state-actions").getBoundingClientRect();
    const canvasText: string = ForcedColorsFixture.resolve("CanvasText");

    expect([rem(mark.width), rem(mark.height), rem(title.top - mark.bottom), rem(text.top - title.bottom), rem(actions.top - text.bottom)]).toEqual([2.5, 2.5, 0.5, 0.5, 0.75]);
    expect([rem(button(1).getBoundingClientRect().left - button().getBoundingClientRect().right), Math.round(mark.left + mark.width / 2 - (box.left + box.width / 2))]).toEqual([0.5, 0]);
    expect([getComputedStyle(host).backgroundColor, getComputedStyle(glyph).color, getComputedStyle(heading).color, getComputedStyle(detail).color])
      .toEqual([ForcedColorsFixture.resolve("Canvas"), canvasText, canvasText, canvasText]);
  });

  for (const mode of [ThemeMode.Light, ThemeMode.Dark]) {
    it(`lays out the page's state in rem, centred on the panel, in the ${mode} theme`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      await showAsync(failed("ERR_NAME_NOT_RESOLVED"));
      const host: HTMLElement = find("nol-browser-page-state");
      const glyph: HTMLElement = find(".nol-browser-page-state-glyph");
      const heading: DOMRect = find(".nol-browser-page-state-heading").getBoundingClientRect();
      const detail: HTMLElement = find(".nol-browser-page-state-detail");
      const actions: DOMRect = find(".nol-browser-page-state-actions").getBoundingClientRect();
      const box: DOMRect = host.getBoundingClientRect();
      const mark: DOMRect = glyph.getBoundingClientRect();
      const text: DOMRect = detail.getBoundingClientRect();
      const first: DOMRect = button().getBoundingClientRect();
      const second: DOMRect = button(1).getBoundingClientRect();
      const panel: CSSStyleDeclaration = getComputedStyle(find(".panel"));

      expect([rem(mark.width), rem(mark.height), rem(heading.top - mark.bottom), rem(text.top - heading.bottom), rem(actions.top - text.bottom)]).toEqual([2.5, 2.5, 0.5, 0.5, 0.75]);
      expect([rem(text.width) <= 28, rem(second.left - first.right), Math.round(mark.left + mark.width / 2 - (box.left + box.width / 2))]).toEqual([true, 0.5, 0]);
      expect([box.width, box.height, rem(Number.parseFloat(getComputedStyle(host).paddingTop))]).toEqual([640, 400, 2]);
      expect([getComputedStyle(host).backgroundColor, getComputedStyle(glyph).color, getComputedStyle(detail).color]).toEqual([panel.backgroundColor, panel.color, panel.color]);
    });
  }
});

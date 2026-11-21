/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { AnnouncementPoliteness, Announcer, DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RequestNoticeComponent } from "../../../../src/app/components/request-notice/request-notice.component.ts";
import { AddressRefusal } from "../../../../src/app/enums/address-refusal.ts";
import { RefusedRequest } from "../../../../src/app/enums/refused-request.ts";
import { ViewRequestRefusalEvent } from "../../../../src/app/models/view-request-refusal-event.ts";
import { ViewStateEvent } from "../../../../src/app/models/view-state-event.ts";
import { PaneController } from "../../../../src/app/services/pane-controller.ts";
import { FakeWebView, FakeWebViews } from "../../../fixtures/fake-web-views.fixture.ts";
import { ForcedColorsFixture } from "../../../fixtures/forced-colors.fixture.ts";
import { ZoomFixture } from "../../../fixtures/zoom.fixture.ts";

@Component({
  imports: [RequestNoticeComponent],
  template: `<div class="frame" style="width: 640px"><nol-browser-request-notice [controller]="controller()" [appName]="appName()" (focusLeaving)="leaves = leaves + 1"
    (externalOpened)="links.push($event)" /></div>
    <div class="probe" style="background: var(--nol-raised); border: 1px solid var(--nol-card-border); color: var(--nol-warning)"></div>`
})
class HostComponent {
  public readonly controller: WritableSignal<PaneController> = signal(new PaneController(null));
  public readonly appName: WritableSignal<string | null> = signal("Fixture App");
  public readonly links: string[] = [];
  public leaves: number = 0;
}

describe("RequestNoticeComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;
  let view: FakeWebView;
  let said: [string, AnnouncementPoliteness][];

  function shown(): [string | undefined, string | undefined, (string | undefined)[]] {
    return [
      element.querySelector(".nol-browser-request-notice-glyph")?.textContent?.trim(),
      element.querySelector(".nol-browser-request-notice-message")?.textContent?.trim(),
      [...element.querySelectorAll("button")].map(t => t.textContent?.trim())
    ];
  }

  function find(selector: string): HTMLElement {
    const found: HTMLElement | null = element.querySelector<HTMLElement>(selector);
    if (found === null)
      throw new Error(`The notice has no ${selector}.`);
    return found;
  }

  function rem(pixels: number): number {
    return Math.round(pixels / Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 10000) / 10000;
  }

  async function loadAsync(): Promise<void> {
    view.emit(new ViewStateEvent("https://docs.example.com/pricing", "Plans", true, false, false));
    view.emit(new ViewStateEvent("https://docs.example.com/pricing", "Plans", false, false, false));
    await fixture.whenStable();
  }

  // The pane's own refusal comes from the window part, never from a view's event.
  async function refuseAsync(request: RefusedRequest): Promise<void> {
    if (request === RefusedRequest.PopupSites)
      fixture.componentInstance.controller().refuseRequest(request);
    else
      view.emit(new ViewRequestRefusalEvent(request, "https://one.example"));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    said = [];
    AppearanceFixture.apply();
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
      fixture.destroy();
    }
    finally {
      AppearanceFixture.reset();
      await Promise.all([ForcedColorsFixture.resetAsync(), ZoomFixture.resetAsync()]);
    }
  });

  it("shows nothing and says nothing while no notice stands", () => {
    expect([element.querySelector("nol-browser-request-notice")?.childElementCount, said]).toEqual([0, []]);
  });

  it("names each refused request with its glyph, as the app's browser doesn't have it, and offers the page in the system's browser", async () => {
    const notices: [string | undefined, string | undefined][] = [];
    await loadAsync();
    for (const request of Object.values(RefusedRequest)) {
      await refuseAsync(request);
      const [glyph, message, buttons] = shown();
      expect(buttons).toEqual(request === RefusedRequest.PopupSites ? [] : ["Open in external browser"]);
      notices.push([glyph, message]);
    }

    expect(notices).toEqual([
      ["download", "Downloads aren't available in Fixture App's browser yet."],
      ["tab", "This page asked for a new window, and Fixture App's browser didn't open it."],
      ["location_off", "Site permissions, such as the camera or your location, aren't available in Fixture App's browser yet."],
      ["upload_file", "Opening files from this computer isn't available in Fixture App's browser yet."],
      ["key_off", "Sign-in dialogs aren't available in Fixture App's browser yet."],
      ["gpp_bad", "This page's certificate wasn't accepted, so Fixture App's browser didn't open it."],
      ["web_asset_off", "Pages shown inside other pages aren't available in Fixture App's browser yet."],
      ["block", "Settings didn't add this site to Allow pop-ups, so Fixture App's browser still blocks its pop-ups."]
    ]);
    await refuseAsync(RefusedRequest.Download);
    find("button").click();
    expect(fixture.componentInstance.links).toEqual(["https://docs.example.com/pricing"]);
  });

  it("offers a new window that didn't open at its own address in the system's browser, not at the page that asked for it", async () => {
    await loadAsync();
    fixture.componentInstance.controller().refuseRequest(RefusedRequest.NewWindow, "https://status.example.com/");
    await fixture.whenStable();

    find("button").click();

    expect([shown()[1], fixture.componentInstance.links])
      .toEqual(["This page asked for a new window, and Fixture App's browser didn't open it.", ["https://status.example.com/"]]);
  });

  it("names the browser the person is in while the app's name is unknown, and the app once it is known", async () => {
    fixture.componentInstance.appName.set(null);
    await refuseAsync(RefusedRequest.Download);

    expect(shown()[1]).toBe("Downloads aren't available in this browser yet.");
    fixture.componentInstance.appName.set("Fixture App");
    await fixture.whenStable();
    expect(shown()[1]).toBe("Downloads aren't available in Fixture App's browser yet.");
  });

  it("starts every refused request's notice with a capital while the app's name is unknown", async () => {
    const starts: string[] = [];
    fixture.componentInstance.appName.set(null);
    await loadAsync();
    for (const request of Object.values(RefusedRequest)) {
      await refuseAsync(request);
      starts.push(shown()[1]?.charAt(0) ?? "");
    }

    expect([starts.length, starts.filter(t => !/^[A-Z]/.test(t))]).toEqual([Object.values(RefusedRequest).length, []]);
  });

  it("shows no notice for a blocked pop-up, which the address bar offers, and keeps a refused request's notice beside it", async () => {
    await loadAsync();
    fixture.componentInstance.controller().offerPopup("https://ads.example.com/", null);
    await fixture.whenStable();
    const alone: ReturnType<typeof shown> = shown();
    await refuseAsync(RefusedRequest.Download);
    fixture.componentInstance.controller().offerPopup("https://more-ads.example.com/", null);
    await fixture.whenStable();

    expect([alone, shown()[1]]).toEqual([[undefined, undefined, []], "Downloads aren't available in Fixture App's browser yet."]);
  });

  it("says why the pane didn't go to a typed address, each reason in its own words, with no action, in place of a refused request", async () => {
    const controller: PaneController = fixture.componentInstance.controller();
    await refuseAsync(RefusedRequest.Download);
    const texts: (string | undefined)[] = [];
    for (const reason of Object.values(AddressRefusal)) {
      controller.refuseAddress(reason);
      await fixture.whenStable();
      const [glyph, message, buttons] = shown();
      expect([glyph, buttons]).toEqual(["error", []]);
      texts.push(message);
    }

    expect(texts).toEqual([
      "Type a web address, such as example.com.",
      "Fixture App's browser opens only addresses that start with http: or https:.",
      "This address is too long to open.",
      "Fixture App's browser doesn't open addresses with a user name or password.",
      "Fixture App's browser opens an address on this computer or its network only once Settings names its site, under Sites on this computer or network.",
      "Fixture App's browser never opens this address.",
      "Fixture App's browser couldn't allow this address's site in the workspace. Try again."
    ]);
    expect([controller.status.refusedRequest, said.at(-1)]).toEqual([null, ["Fixture App's browser couldn't allow this address's site in the workspace. Try again.", AnnouncementPoliteness.Polite]]);
  });

  it("goes with the tab's next load, and tells the page only while it holds the focus", async () => {
    await refuseAsync(RefusedRequest.Download);
    await fixture.componentInstance.controller().navigateAsync("https://two.example/");
    await fixture.whenStable();

    expect([shown(), fixture.componentInstance.leaves]).toEqual([[undefined, undefined, []], 0]);
  });

  it("announces each new notice politely, once, without taking focus", async () => {
    const before = document.activeElement;

    await refuseAsync(RefusedRequest.Download);
    await refuseAsync(RefusedRequest.Download);
    await refuseAsync(RefusedRequest.Certificate);

    expect(said).toEqual([
      ["Downloads aren't available in Fixture App's browser yet.", AnnouncementPoliteness.Polite],
      ["This page's certificate wasn't accepted, so Fixture App's browser didn't open it.", AnnouncementPoliteness.Polite]
    ]);
    expect(document.activeElement).toBe(before);
  });

  it("doesn't announce its notice again when the page's status changes but the notice's text doesn't", async () => {
    await loadAsync();
    await refuseAsync(RefusedRequest.Download);
    view.emit(new ViewStateEvent("https://docs.example.com/pricing", "Plans and prices", false, false, false));
    view.emit(new ViewStateEvent("https://docs.example.com/pricing", "Plans and prices", false, true, false));
    await fixture.whenStable();

    expect([shown()[1], said]).toEqual([
      "Downloads aren't available in Fixture App's browser yet.",
      [["Downloads aren't available in Fixture App's browser yet.", AnnouncementPoliteness.Polite]]
    ]);
  });

  it("follows the controller it is given, and leaves the one before", async () => {
    const previous = fixture.componentInstance.controller();
    await refuseAsync(RefusedRequest.Download);
    const next = new FakeWebViews().open("workspace-1");
    fixture.componentInstance.controller.set(new PaneController(next));
    await fixture.whenStable();

    expect(shown()).toEqual([undefined, undefined, []]);
    view.emit(new ViewRequestRefusalEvent(RefusedRequest.NewWindow, "https://one.example"));
    next.emit(new ViewRequestRefusalEvent(RefusedRequest.NestedView, "https://two.example"));
    await fixture.whenStable();

    expect([shown()[1], previous.status.refusedRequest]).toEqual(["Pages shown inside other pages aren't available in Fixture App's browser yet.", RefusedRequest.NewWindow]);
  });

  for (const zoom of [1, 2]) {
    it(`fits the pane's smallest width, 10rem${zoom === 2 ? ", at 200% zoom" : ""}: the glyph beside the message, the action whole under it at 24 pixels or more, and nothing scrolls sideways`, async () => {
      const ratio: number = devicePixelRatio;
      await ZoomFixture.zoomAsync(zoom);
      await vi.waitFor(() => expect(devicePixelRatio).toBe(ratio * zoom));
      find(".frame").style.width = `${AppearanceFixture.toPixels(10)}px`;
      await loadAsync();
      await refuseAsync(RefusedRequest.Authentication);
      const frame: DOMRect = find(".frame").getBoundingClientRect();
      const bar: HTMLElement = find(".nol-browser-request-notice-bar");
      const box: DOMRect = bar.getBoundingClientRect();
      const glyph: DOMRect = find(".nol-browser-request-notice-glyph").getBoundingClientRect();
      const message: DOMRect = find(".nol-browser-request-notice-message").getBoundingClientRect();
      const action: DOMRect = find(".nol-browser-request-notice-action").getBoundingClientRect();

      expect([
        bar.scrollWidth <= bar.clientWidth && box.left >= frame.left && box.right <= frame.right + 0.5,
        action.left >= box.left - 0.5 && action.right <= box.right + 0.5 && action.width >= 24 && action.height >= 24,
        action.top >= message.bottom - 0.5,
        glyph.right <= message.left && glyph.top < message.bottom && glyph.bottom > message.top
      ]).toEqual([true, true, true, true]);
    });
  }

  it("keeps the notice under forced colours: its place and insets, an edge all round and its glyph and message in the system's text colour", async () => {
    await loadAsync();
    await refuseAsync(RefusedRequest.Download);
    await ForcedColorsFixture.activateAsync();
    const frame: DOMRect = find(".frame").getBoundingClientRect();
    const bar: HTMLElement = find(".nol-browser-request-notice-bar");
    const box: DOMRect = bar.getBoundingClientRect();
    const mark: DOMRect = find(".nol-browser-request-notice-glyph").getBoundingClientRect();
    const action: DOMRect = find("button").getBoundingClientRect();
    const style: CSSStyleDeclaration = getComputedStyle(bar);
    const text: string = ForcedColorsFixture.resolve("CanvasText");

    expect([rem(box.left - frame.left), rem(frame.right - box.right), rem(mark.left - box.left), rem(box.right - action.right)]).toEqual([0.25, 0.25, 0.8125, 0.8125]);
    expect([style.borderTopStyle, style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle, Number.parseFloat(style.borderLeftWidth)])
      .toEqual(["solid", "solid", "solid", "solid", 1]);
    expect([style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor, getComputedStyle(find(".nol-browser-request-notice-glyph")).color,
      getComputedStyle(find(".nol-browser-request-notice-message")).color]).toEqual([text, text, text, text, text, text]);
  });

  for (const mode of [ThemeMode.Light, ThemeMode.Dark]) {
    it(`lays out the notice in rem, on the raised surface with its glyph in the warning colour, in the ${mode} theme`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      await loadAsync();
      await refuseAsync(RefusedRequest.Download);
      const frame: DOMRect = find(".frame").getBoundingClientRect();
      const bar: HTMLElement = find(".nol-browser-request-notice-bar");
      const box: DOMRect = bar.getBoundingClientRect();
      const glyph: HTMLElement = find(".nol-browser-request-notice-glyph");
      const mark: DOMRect = glyph.getBoundingClientRect();
      const message: DOMRect = find(".nol-browser-request-notice-message").getBoundingClientRect();
      const action: DOMRect = find("button").getBoundingClientRect();
      const style: CSSStyleDeclaration = getComputedStyle(bar);
      const probe: CSSStyleDeclaration = getComputedStyle(find(".probe"));

      expect([rem(box.left - frame.left), rem(frame.right - box.right), rem(mark.left - box.left), rem(box.right - action.right)]).toEqual([0.25, 0.25, 0.8125, 0.8125]);
      expect([rem(message.left - mark.right), rem(Number.parseFloat(style.paddingTop)), rem(Number.parseFloat(style.marginBottom)), Math.round(action.top - box.top) === Math.round(box.bottom - action.bottom)])
        .toEqual([0.5, 0.375, 0.25, true]);
      expect([style.backgroundColor, style.borderTopColor, getComputedStyle(glyph).color]).toEqual([probe.backgroundColor, probe.borderTopColor, probe.color]);
    });
  }
});

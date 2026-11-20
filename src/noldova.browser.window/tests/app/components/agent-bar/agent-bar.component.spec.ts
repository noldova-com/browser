/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { PageAction, PageActivity, PageActivityState } from "@noldova/browser.protocol";
import type { JsonObject } from "@noldova/context.json";
import { AnnouncementPoliteness, Announcer, DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { AgentBarComponent } from "../../../../src/app/components/agent-bar/agent-bar.component.ts";
import { ForcedColorsFixture } from "../../../fixtures/forced-colors.fixture.ts";
import { ZoomFixture } from "../../../fixtures/zoom.fixture.ts";

const ACTING: PageActivity = PageActivity.fromJson({
  instance: "0f8fad5b-d9cb-469f-a165-70867728950e", activity: "5b1c2a7e-3d4f-4e8a-9b0c-1d2e3f4a5b6c", agentName: "Scout", action: PageAction.Clicking, state: PageActivityState.Acting,
  box: null, point: null, refusal: null, isHandedOver: false
});

@Component({
  imports: [AgentBarComponent],
  template: `<div class="frame" [style.width.px]="width()"><nol-browser-agent-bar [activity]="activity()" (tookOver)="answers.push('take over')" (stopped)="answers.push('stop')" /></div>
    <div class="probe" style="background: var(--nol-hover-widget); border-top: var(--nol-border-width) solid var(--nol-accent); color: var(--nol-accent);
      outline-color: var(--nol-text); font-weight: var(--nol-weight-strong)"></div>`
})
class HostComponent {
  public readonly activity: WritableSignal<PageActivity> = signal(ACTING);
  public readonly width: WritableSignal<number> = signal(640);
  public readonly answers: string[] = [];
}

describe("AgentBarComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;
  let said: [string, AnnouncementPoliteness][];

  function find(selector: string): HTMLElement {
    const found: HTMLElement | null = element.querySelector<HTMLElement>(selector);
    if (found === null)
      throw new Error(`The bar has no ${selector}.`);
    return found;
  }

  function buttons(): HTMLButtonElement[] {
    return [...element.querySelectorAll("button")];
  }

  function rem(pixels: number): number {
    return Math.round(pixels / Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 10000) / 10000;
  }

  async function showAsync(activity: JsonObject): Promise<void> {
    fixture.componentInstance.activity.set(PageActivity.fromJson({ ...ACTING.toJson(), ...activity }));
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
    fixture = TestBed.createComponent(HostComponent);
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

  it("names the teammate and says it is using the page, with Take over and Stop teammate", () => {
    expect([find(".nol-browser-agent-bar-glyph").textContent?.trim(), find(".nol-browser-agent-bar-name").textContent?.trim(),
      find(".nol-browser-agent-bar-message").textContent?.trim(), buttons().map(t => t.textContent?.trim())])
      .toEqual(["smart_toy", "Scout", "Scout is using this page", ["Take over", "Stop teammate"]]);
    expect(find(".nol-browser-agent-bar-glyph").getAttribute("aria-hidden")).toBe("true");
  });

  it("says the teammate waits for the person's answer while its call asks, and offers no button while the app's card asks", async () => {
    await showAsync({ state: PageActivityState.Asking });

    expect([find(".nol-browser-agent-bar-message").textContent?.trim(), buttons().length]).toEqual(["Scout is waiting for your answer", 0]);
  });

  it("names a teammate the app gave no name, or only spaces, as a teammate", async () => {
    await showAsync({ agentName: "  " });

    expect(find(".nol-browser-agent-bar-message").textContent?.trim()).toBe("A teammate is using this page");
  });

  it("says politely what the teammate does each time that changes, and not again for the next call that does the same", async () => {
    await showAsync({ activity: "9d3c1b2a-0f4e-4d5c-8b7a-6f5e4d3c2b1a" });
    await showAsync({ state: PageActivityState.Asking });
    await showAsync({ state: PageActivityState.Acting });

    expect(said).toEqual([
      ["Scout is using this page", AnnouncementPoliteness.Polite],
      ["Scout is waiting for your answer", AnnouncementPoliteness.Polite],
      ["Scout is using this page", AnnouncementPoliteness.Polite]
    ]);
  });

  it("tells the page when the person takes over or stops, through buttons the keyboard reaches in order", async () => {
    const [takeOver, stop] = buttons();
    takeOver?.click();
    stop?.click();
    await fixture.whenStable();

    expect([fixture.componentInstance.answers, buttons().map(t => [t.type, t.tabIndex, t.disabled])])
      .toEqual([["take over", "stop"], [["button", 0, false], ["button", 0, false]]]);
  });

  it("takes over with Enter and stops with Space, Tab going from Take over to Stop teammate", async () => {
    const [takeOver, stop] = buttons();
    takeOver?.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    const reached: boolean = document.activeElement === stop;
    await userEvent.keyboard(" ");
    await fixture.whenStable();

    expect([fixture.componentInstance.answers, reached]).toEqual([["take over", "stop"], true]);
  });

  for (const zoom of [1, 2]) {
    it(`fits the pane's smallest width, 10rem${zoom === 2 ? ", at 200% zoom" : ""}: the glyph beside the message, the buttons wrapped under it, whole, at least 24 pixels square, and nothing scrolls sideways`, async () => {
      const ratio: number = devicePixelRatio;
      await ZoomFixture.zoomAsync(zoom);
      await vi.waitFor(() => expect(devicePixelRatio).toBe(ratio * zoom));
      fixture.componentInstance.width.set(AppearanceFixture.toPixels(10));
      await fixture.whenStable();
      const row: HTMLElement = find(".nol-browser-agent-bar-row");
      const box: DOMRect = row.getBoundingClientRect();
      const message: DOMRect = find(".nol-browser-agent-bar-message").getBoundingClientRect();
      const glyph: DOMRect = find(".nol-browser-agent-bar-glyph").getBoundingClientRect();
      const targets: DOMRect[] = buttons().map(t => t.getBoundingClientRect());

      expect([
        row.scrollWidth <= row.clientWidth,
        targets.every(t => t.left >= box.left - 0.5 && t.right <= box.right + 0.5 && t.width >= 24 && t.height >= 24),
        targets.every(t => t.top >= message.bottom - 0.5),
        glyph.right <= message.left && glyph.top < message.bottom && glyph.bottom > message.top
      ]).toEqual([true, true, true, true]);
    });
  }

  it("keeps an edge all round the bar and its glyph in the system's text colour under forced colours", async () => {
    await ForcedColorsFixture.activateAsync();
    const text: string = ForcedColorsFixture.resolve("CanvasText");
    const style: CSSStyleDeclaration = getComputedStyle(find(".nol-browser-agent-bar-row"));

    expect([style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor, getComputedStyle(find(".nol-browser-agent-bar-glyph")).color])
      .toEqual([text, text, text, text, text]);
    expect([style.borderTopStyle, style.borderBottomStyle, rem(Number.parseFloat(style.borderLeftWidth))]).toEqual(["solid", "solid", rem(1)]);
  });

  for (const mode of [ThemeMode.Light, ThemeMode.Dark]) {
    it(`lays out the agent bar in rem, the document's full width, its buttons compact, tinted with the accent and its glyph in the accent, in the ${mode} theme`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      await fixture.whenStable();
      const frame: DOMRect = find(".frame").getBoundingClientRect();
      const row: HTMLElement = find(".nol-browser-agent-bar-row");
      const box: DOMRect = row.getBoundingClientRect();
      const glyph: HTMLElement = find(".nol-browser-agent-bar-glyph");
      const mark: DOMRect = glyph.getBoundingClientRect();
      const message: DOMRect = find(".nol-browser-agent-bar-message").getBoundingClientRect();
      const [takeOver, stop] = buttons().map(t => t.getBoundingClientRect());
      const style: CSSStyleDeclaration = getComputedStyle(row);
      const probe: CSSStyleDeclaration = getComputedStyle(find(".probe"));

      expect([rem(box.left - frame.left), rem(frame.right - box.right), rem(mark.left - box.left), rem(box.right - (stop?.right ?? 0))]).toEqual([0, 0, 0.75, 0.5]);
      const button: number = 1.5;
      expect([rem(message.left - mark.right), rem((stop?.left ?? 0) - (takeOver?.right ?? 0)), rem(takeOver?.height ?? 0), rem(stop?.height ?? 0)]).toEqual([0.5, 0.5, button, button]);
      expect([rem(Number.parseFloat(style.paddingTop)), rem(Number.parseFloat(style.paddingBottom)), rem(Number.parseFloat(style.borderTopWidth))])
        .toEqual([0.25, 0.25, rem(1)]);
      expect([rem(box.height - 1) - button, rem((takeOver?.top ?? 0) - box.top - 1), rem(box.bottom - (takeOver?.bottom ?? 0))]).toEqual([0.5, 0.25, 0.25]);
      expect([style.backgroundColor, style.borderTopColor, getComputedStyle(glyph).color, style.color, getComputedStyle(find(".nol-browser-agent-bar-name")).fontWeight])
        .toEqual([probe.backgroundColor, probe.borderTopColor, probe.color, probe.outlineColor, probe.fontWeight]);
    });
  }
});

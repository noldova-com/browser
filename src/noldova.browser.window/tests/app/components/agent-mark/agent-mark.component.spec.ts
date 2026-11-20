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
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentMarkComponent } from "../../../../src/app/components/agent-mark/agent-mark.component.ts";
import { ContrastFixture } from "../../../fixtures/contrast.fixture.ts";
import { ForcedColorsFixture } from "../../../fixtures/forced-colors.fixture.ts";
import { ZoomFixture } from "../../../fixtures/zoom.fixture.ts";

const CLICKING: PageActivity = PageActivity.fromJson({
  instance: "0f8fad5b-d9cb-469f-a165-70867728950e", activity: "5b1c2a7e-3d4f-4e8a-9b0c-1d2e3f4a5b6c", agentName: "Scout", action: PageAction.Clicking, state: PageActivityState.Acting,
  box: { x: 40, y: 30, width: 120, height: 24 }, point: { x: 100, y: 42 }, refusal: null, isHandedOver: false
});

@Component({
  imports: [AgentMarkComponent],
  template: `<div class="frame" style="position: relative; width: 480px; height: 320px"><nol-browser-agent-mark [activity]="activity()" [zoom]="zoom()" /></div>
    <div class="probe" style="border: 1px solid var(--nol-button); background: var(--nol-button); color: var(--nol-button-text); font-weight: var(--nol-weight-emphasis)"></div>`
})
class HostComponent {
  public readonly activity: WritableSignal<PageActivity> = signal(CLICKING);
  public readonly zoom: WritableSignal<number> = signal(1);
}

describe("AgentMarkComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;

  function find(selector: string): HTMLElement {
    const found: HTMLElement | null = element.querySelector<HTMLElement>(selector);
    if (found === null)
      throw new Error(`The mark has no ${selector}.`);
    return found;
  }

  function rem(pixels: number): number {
    return Math.round(pixels / Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 10000) / 10000;
  }

  async function onWhitePageAsync(mode: ThemeMode, selector: string): Promise<HTMLElement> {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    find(".frame").style.background = "#FFFFFF";
    await fixture.whenStable();
    return find(selector);
  }

  function below(pairs: readonly (readonly [string, number, number])[]): string[] {
    return pairs.filter(([, ratio, minimum]) => ratio < minimum).map(([name, ratio, minimum]) => `${name}: ${ratio.toFixed(2)} < ${minimum}`);
  }

  async function showAsync(activity: JsonObject): Promise<void> {
    fixture.componentInstance.activity.set(PageActivity.fromJson({ ...CLICKING.toJson(), ...activity }));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    AppearanceFixture.apply();
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
      fixture.destroy();
    }
    finally {
      AppearanceFixture.reset();
      await Promise.all([ForcedColorsFixture.resetAsync(), ZoomFixture.resetAsync()]);
    }
  });

  it("names the teammate and what it does in the tag, with the action's glyph, or that it waits for the answer, and hides from assistive technology", async () => {
    const shown = (): (string | null | undefined)[] => [find(".nol-browser-agent-mark-glyph").textContent, find(".nol-browser-agent-mark-text").textContent];
    expect([...shown(), find("nol-browser-agent-mark").getAttribute("aria-hidden")]).toEqual(["ads_click", "Scout · clicking", "true"]);

    await showAsync({ action: PageAction.Typing, agentName: " " });
    expect(shown()).toEqual(["keyboard", "A teammate · typing"]);
    await showAsync({ action: PageAction.Typing, state: PageActivityState.Asking });
    expect(shown()).toEqual(["keyboard", "Scout · waiting for your answer"]);
  });

  it("draws no ring without a box and no pointer without a point", async () => {
    await showAsync({ box: null, point: null });

    expect(element.querySelectorAll(".nol-browser-agent-mark-ring, .nol-browser-agent-mark-tag, .nol-browser-agent-mark-pointer").length).toBe(0);
  });

  it("scales the page's box and point by the view's zoom, at 150%, and keeps the ring's, tag's and pointer's own sizes", async () => {
    fixture.componentInstance.zoom.set(1.5);
    await fixture.whenStable();
    const frame: DOMRect = find(".frame").getBoundingClientRect();
    const outer: DOMRect = find(".nol-browser-agent-mark-ring").getBoundingClientRect();
    const label: DOMRect = find(".nol-browser-agent-mark-tag").getBoundingClientRect();
    const pointer: DOMRect = find(".nol-browser-agent-mark-pointer").getBoundingClientRect();

    expect([rem(outer.left - frame.left - 60), rem(outer.top - frame.top - 45), rem(outer.width - 180), rem(outer.height - 36)]).toEqual([-0.25, -0.25, 0.5, 0.5]);
    expect([rem(label.left - outer.left), rem(label.top - outer.bottom), rem(label.height), rem(pointer.left - frame.left - 150), rem(pointer.top - frame.top - 63), rem(pointer.width)])
      .toEqual([0.125, 0.125, 1.25, -0.125, -0.125, 1.125]);
  });

  for (const mode of [ThemeMode.Light, ThemeMode.Dark]) {
    it(`rings the element 0.25rem outside it in the kit's button colour, tags it under the ring and points at the click as the design draws them, taking no input, in the ${mode} theme`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      await fixture.whenStable();
      const frame: DOMRect = find(".frame").getBoundingClientRect();
      const ring: HTMLElement = find(".nol-browser-agent-mark-ring");
      const outer: DOMRect = ring.getBoundingClientRect();
      const tag: HTMLElement = find(".nol-browser-agent-mark-tag");
      const label: DOMRect = tag.getBoundingClientRect();
      const pointer: DOMRect = find(".nol-browser-agent-mark-pointer").getBoundingClientRect();
      const probe: CSSStyleDeclaration = getComputedStyle(find(".probe"));

      expect([rem(outer.left - frame.left - 40), rem(outer.top - frame.top - 30), rem(outer.width - 120), rem(outer.height - 24)]).toEqual([-0.25, -0.25, 0.5, 0.5]);
      expect([rem(label.left - outer.left), rem(label.top - outer.bottom), rem(label.height), rem(pointer.left - frame.left - 100), rem(pointer.top - frame.top - 42), rem(pointer.width)])
        .toEqual([0.125, 0.125, 1.25, -0.125, -0.125, 1.125]);
      expect([getComputedStyle(ring).borderTopColor, rem(Number.parseFloat(getComputedStyle(ring).borderTopWidth)), rem(Number.parseFloat(getComputedStyle(ring).borderTopLeftRadius)),
        getComputedStyle(tag).backgroundColor, getComputedStyle(tag).color, getComputedStyle(tag).fontWeight, getComputedStyle(find(".nol-browser-agent-mark-pointer")).stroke])
        .toEqual([probe.borderTopColor, 0.125, 0.625, probe.backgroundColor, probe.color, probe.fontWeight, "rgb(31, 35, 40)"]);
      expect(getComputedStyle(find("nol-browser-agent-mark")).pointerEvents).toBe("none");
    });

    it(`keeps the pointer's edge at 3:1 over a white page and its fill at 3:1 to its edge, in the ${mode} theme`, async () => {
      const pointer: HTMLElement = await onWhitePageAsync(mode, ".nol-browser-agent-mark-pointer");

      expect(below([
        ["the pointer's edge", ContrastFixture.ofEdge(pointer, "stroke"), 3],
        ["the pointer's fill", ContrastFixture.ratio(ContrastFixture.parse(getComputedStyle(pointer).fill), ContrastFixture.parse(getComputedStyle(pointer).stroke)), 3]
      ])).toEqual([]);
    });

    it(`keeps the tag's text at 4.5:1 on its fill and the ring at 3:1 over a white page and over a black one, in the ${mode} theme`, async () => {
      const ring: HTMLElement = await onWhitePageAsync(mode, ".nol-browser-agent-mark-ring");
      const pairs: (readonly [string, number, number])[] = [
        ["the tag", ContrastFixture.ofText(find(".nol-browser-agent-mark-tag")), 4.5],
        ["the ring over white", ContrastFixture.ofEdge(ring, "border-top-color"), 3]
      ];
      find(".frame").style.background = "#000000";
      pairs.push(["the ring over black", ContrastFixture.ofEdge(ring, "border-top-color"), 3]);

      expect(below(pairs)).toEqual([]);
    });
  }

  for (const zoom of [1, 2]) {
    it(`keeps the ring, the tag and the pointer whole and in place at the pane's smallest width, 10rem${zoom === 2 ? ", at 200% zoom" : ""}`, async () => {
      const ratio: number = devicePixelRatio;
      await ZoomFixture.zoomAsync(zoom);
      await vi.waitFor(() => expect(devicePixelRatio).toBe(ratio * zoom));
      find(".frame").style.width = `${AppearanceFixture.toPixels(10)}px`;
      await showAsync({ box: { x: 8, y: 30, width: 100, height: 24 }, point: { x: 60, y: 42 } });
      const frame: DOMRect = find(".frame").getBoundingClientRect();
      const outer: DOMRect = find(".nol-browser-agent-mark-ring").getBoundingClientRect();
      const label: DOMRect = find(".nol-browser-agent-mark-tag").getBoundingClientRect();
      const text: HTMLElement = find(".nol-browser-agent-mark-text");
      const pointer: DOMRect = find(".nol-browser-agent-mark-pointer").getBoundingClientRect();

      expect([rem(outer.left - frame.left - 8), rem(outer.width - 100), label.left >= frame.left && label.right <= frame.right + 0.5, rem(label.height),
        text.scrollHeight <= text.clientHeight, rem(pointer.left - frame.left - 60), rem(pointer.width), pointer.right <= frame.right])
        .toEqual([-0.25, 0.5, true, 1.25, true, -0.125, 1.125, true]);
    });
  }

  it("draws the ring, the tag's edge and the pointer in the system's highlight under forced colors", async () => {
    await ForcedColorsFixture.activateAsync();
    const highlight: string = ForcedColorsFixture.resolve("Highlight");

    expect([getComputedStyle(find(".nol-browser-agent-mark-ring")).borderTopColor, getComputedStyle(find(".nol-browser-agent-mark-tag")).borderTopColor,
      getComputedStyle(find(".nol-browser-agent-mark-tag")).borderTopStyle, getComputedStyle(find(".nol-browser-agent-mark-tag")).borderTopWidth,
      getComputedStyle(find(".nol-browser-agent-mark-pointer")).fill, getComputedStyle(find(".nol-browser-agent-mark-pointer")).stroke])
      .toEqual([highlight, highlight, "solid", getComputedStyle(find(".probe")).borderTopWidth, highlight, ForcedColorsFixture.resolve("Canvas")]);
  });

  it("keeps the ring and the tag whole inside the page for an element at its top left corner, the ring still 0.25rem past the element's other edges", async () => {
    await showAsync({ box: { x: 0, y: 0, width: 120, height: 24 }, point: null });
    const frame: DOMRect = find(".frame").getBoundingClientRect();
    const outer: DOMRect = find(".nol-browser-agent-mark-ring").getBoundingClientRect();
    const label: DOMRect = find(".nol-browser-agent-mark-tag").getBoundingClientRect();

    expect([rem(outer.left - frame.left), rem(outer.top - frame.top), rem(outer.right - frame.left - 120), rem(outer.bottom - frame.top - 24), rem(label.left - frame.left)])
      .toEqual([0, 0, 0.25, 0.25, 0]);
  });

  it("keeps the tag at its place under an element near the page's right edge, as wide as the space left there and cut with an ellipsis", async () => {
    find(".frame").style.width = `${AppearanceFixture.toPixels(20)}px`;
    await showAsync({ agentName: "A teammate with a long name", box: { x: AppearanceFixture.toPixels(14), y: 30, width: 40, height: 24 }, point: null });
    const frame: DOMRect = find(".frame").getBoundingClientRect();
    const label: DOMRect = find(".nol-browser-agent-mark-tag").getBoundingClientRect();
    const text: HTMLElement = find(".nol-browser-agent-mark-text");

    expect([rem(label.left - frame.left), rem(frame.right - label.right), text.scrollWidth > text.clientWidth, getComputedStyle(text).textOverflow])
      .toEqual([13.875, 0, true, "ellipsis"]);
  });

  it("starts the tag early enough under an element 1rem from the page's right edge that it ends at the edge with its glyph and ellipsis inside its fill", async () => {
    find(".frame").style.width = `${AppearanceFixture.toPixels(20)}px`;
    await showAsync({ agentName: "A teammate with a long name", box: { x: AppearanceFixture.toPixels(19), y: 30, width: 16, height: 16 }, point: null });
    const frame: DOMRect = find(".frame").getBoundingClientRect();
    const label: DOMRect = find(".nol-browser-agent-mark-tag").getBoundingClientRect();
    const glyph: DOMRect = find(".nol-browser-agent-mark-glyph").getBoundingClientRect();
    const text: HTMLElement = find(".nol-browser-agent-mark-text");

    expect([rem(frame.right - label.right), rem(label.left - frame.left) < 18.875, glyph.left >= label.left, glyph.right <= label.right, text.clientWidth > 0, getComputedStyle(text).textOverflow])
      .toEqual([0, true, true, true, true, "ellipsis"]);
  });

  it("leaves the tag at its place under an element past the page's right edge, rather than pulling it onto the page", async () => {
    find(".frame").style.width = `${AppearanceFixture.toPixels(20)}px`;
    await showAsync({ box: { x: AppearanceFixture.toPixels(21), y: 30, width: 16, height: 16 }, point: null });

    expect(rem(find(".nol-browser-agent-mark-tag").getBoundingClientRect().left - find(".frame").getBoundingClientRect().left)).toBe(20.875);
  });

  it("keeps the tag inside a narrow page, cut with an ellipsis", async () => {
    await showAsync({ agentName: "A teammate with a very long name indeed, longer than the page is wide", box: { x: 0, y: 30, width: 120, height: 24 } });
    find(".frame").style.width = "160px";
    await fixture.whenStable();

    const frame: DOMRect = find(".frame").getBoundingClientRect();
    const label: DOMRect = find(".nol-browser-agent-mark-tag").getBoundingClientRect();
    expect([label.right <= frame.right, getComputedStyle(find(".nol-browser-agent-mark-text")).textOverflow]).toEqual([true, "ellipsis"]);
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";
import type { Locator } from "playwright/test";

import { expect, test } from "../fixtures/app-test.ts";
import { TestApp } from "../fixtures/test-app.ts";
import { ToolReply } from "../fixtures/tool-reply.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const PRESS_LINE = /button "Press" \[(e\d+)\]/;

// A long, wide page that records the target of each click, the body for a press beside the button; the button is placed against the view's height, in CSS pixels at
// the page's zoom, once the page is scrolled to 1000.
const PAGE = "<!doctype html><title>One</title><body style=\"margin:0;height:8000px;width:3000px\">"
  + "<button type=\"button\" id=\"press\" style=\"position:absolute;left:260px;width:120px;top:0;height:40px\">Press</button>"
  + "<script>window.seen = []; addEventListener(\"click\", t => seen.push(t.target.id || t.target.tagName), true);</script>";

const READ = "(() => { const box = document.getElementById(\"press\").getBoundingClientRect();"
  + " return [scrollX, scrollY, innerHeight, devicePixelRatio, box.top, box.bottom, seen.join(\",\")].join(\" \"); })()";

class ZoomCase {
  public readonly percent: number;
  public readonly item: string;
  public readonly steps: number;

  public constructor(percent: number, item: string, steps: number) {
    this.percent = percent;
    this.item = item;
    this.steps = steps;
  }
}

class Placement {
  public readonly name: string;
  public readonly place: string;
  public readonly isInView: boolean;

  public constructor(name: string, place: string, isInView: boolean) {
    this.name = name;
    this.place = place;
    this.isInView = isInView;
  }
}

class PageState {
  public readonly scrollX: number;
  public readonly scrollY: number;
  public readonly height: number;
  public readonly pixelRatio: number;
  public readonly top: number;
  public readonly bottom: number;
  public readonly seen: readonly string[];

  public constructor(text: string) {
    const parts: string[] = text.split(" ");
    const numberAt = (index: number): number => Number(parts[index] ?? "");
    this.scrollX = numberAt(0);
    this.scrollY = numberAt(1);
    this.height = numberAt(2);
    this.pixelRatio = numberAt(3);
    this.top = numberAt(4);
    this.bottom = numberAt(5);
    const seen: string = parts[6] ?? "";
    this.seen = seen === "" ? [] : seen.split(",");
  }
}

// From 100%, Noldova Desktop's zoom steps reach 50% in five steps out (90, 80, 75, 67, 50) and 200% in five steps in (110, 125, 150, 175, 200).
const ZOOMS: readonly ZoomCase[] = [new ZoomCase(50, "Zoom out", 5), new ZoomCase(100, "Zoom in", 0), new ZoomCase(200, "Zoom in", 5)];

const PLACEMENTS: readonly Placement[] = [
  new Placement("in view, a third of the way down", "press.style.top = (scrollY + Math.round(innerHeight / 3)) + \"px\"", true),
  new Placement("below the view", "press.style.top = (scrollY + 2 * innerHeight) + \"px\"", false)
];

async function readAsync(app: TestApp, url: string, prefix: string = ""): Promise<PageState> {
  return new PageState(await app.viewPages.runAtAsync(url, `${prefix}${READ}`));
}

// Zooms the page as the person does, from the toolbar's More menu, one step at a time.
async function zoomAsync(app: TestApp, zoom: ZoomCase): Promise<void> {
  for (let step: number = 0; step < zoom.steps; step++) {
    await app.window.locator(".nol-browser-toolbar-more").click();
    const menu: Locator = app.window.getByRole("menu");
    await menu.getByRole("menuitem", { name: "Zoom" }).click();
    await app.window.getByRole("menuitem", { name: zoom.item }).click();
    await expect(app.window.getByRole("menu")).toHaveCount(0);
  }
}

test.describe("an agent's click on a page the person zoomed", () => {
  for (const zoom of ZOOMS)
    for (const placement of PLACEMENTS)
      test(`a click at ${zoom.percent}% on a button ${placement.name}, the page scrolled, reaches the button`, async ({ app, servers }) => {
        const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
        const url: string = docs.url("/");
        await app.allowLocalSitesAsync([docs.origin]);
        const instance: string = await app.openPageAsync(url);
        await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(url, "One")]);
        const unzoomed: PageState = await readAsync(app, url);
        await zoomAsync(app, zoom);
        await expect.poll(async () => Math.round((await readAsync(app, url)).pixelRatio / unzoomed.pixelRatio * 100), { message: "The page never took the zoom." })
          .toBe(zoom.percent);
        await app.viewPages.runAtAsync(url, "scrollTo(40, 1000); true");
        const bindings: JsonObject = { page: instance, profileKey: TestApp.PROFILE_KEY };
        const snapshot: string = ToolReply.textOf(await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings }));
        const reference: string = PRESS_LINE.exec(snapshot)?.[1] ?? "";
        expect(reference, "The snapshot names no button.").not.toBe("");
        // Placed once the agent's bar shows and the view has the height left under it, as the bar comes after the call answers.
        await expect(app.window.locator("nol-browser-agent-bar")).toBeVisible();
        const host: Locator = app.window.locator(".nol-browser-page-view");
        await expect.poll(async () => {
          const state: PageState = await readAsync(app, url);
          return Math.abs(state.height * state.pixelRatio / unzoomed.pixelRatio - ((await host.boundingBox())?.height ?? -1)) <= 2;
        }, { message: "The view never took the height under the agent's bar." }).toBe(true);
        await app.viewPages.runAtAsync(url, `const press = document.getElementById("press"); ${placement.place}; true`);
        const before: PageState = await readAsync(app, url, "seen.length = 0; ");
        expect([before.scrollX, before.scrollY, before.top >= 0 && before.bottom <= before.height], "The page isn't scrolled, or the button isn't placed as the case says.")
          .toEqual([40, 1000, placement.isInView]);
        await app.requestAsync("agent-double.planAnswer", { action: "browser.click", answer: "allowOnce" });

        const result: JsonValue = await app.requestAsync("agent-double.callTool", { name: "browser_click", input: { reference }, bindings });

        expect(result, `The click failed: ${ToolReply.textOf(result)}`).toEqual(expect.objectContaining({ isFailure: false }));
        const after: PageState = await readAsync(app, url);
        expect(after.seen, "The press didn't land on the button.").toEqual(["press"]);
        if (placement.isInView)
          expect([after.scrollX, after.scrollY], "The page moved for a button in view.").toEqual([before.scrollX, before.scrollY]);
      });
});
